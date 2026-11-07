import { TIERS } from '../../src/scales';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, actor, forcedRng, createRng } from '../harness';
import {
  band, defaultMode, effectiveSkill, healthLevel, hitTable, moraleCheck, ruleset, stackType, totalHp, usableModes, woundsMods,
  tierLevel,
} from '../../src/ruleset';
import type { Actor } from '../../src/types';

const sword = 'player_arming_sword_1';

describe('ruleset maths', () => {
  it('stacks within a type (Part 1 §4 example)', () => {
    expect(stackType([6, 4, 2])).toBe(8.5);
    expect(stackType([-8, -3])).toBe(-9.5);
    expect(stackType([6, 4, 2, -8, -3])).toBe(-1);
    expect(stackType([5, 5, 5, 5])).toBe(8.75); // fourth counts 0
  });
  it('bands margins exactly, .5 included', () => {
    expect([-75.5, -75, -26, -25.5, -25, -0.5, 0, 24.5, 25, 74.5, 75].map((m) => TIERS.at(band(m)))).toEqual(
      ['critical_failure', 'failure', 'failure', 'failure', 'near_miss', 'near_miss', 'success', 'success', 'great_success', 'great_success', 'critical_success']);
  });
  it('substitutes at half efficiency, highest candidate', () => {
    const s = makeVillage();
    s.player.core.skills.intimidation = { raw: 20, state: 'normal' };
    s.player.core.skills.persuasion = { raw: 60, state: 'normal' };
    expect(effectiveSkill(s, s.player, 'intimidation')).toMatchObject({ skill: 'persuasion', value: 30 });
    const c = ruleset.check({ actorId: 'player', skill: 'intimidation', modifiers: [{ source: 'x', value: 20 }] }, s, createRng(1));
    expect(c).toMatchObject({ skill: 'persuasion', target: 50, passed: true });
  });
  it('grapple substitutes: other unarmed 0.4×, melee 0.2× (Ali, 07/11/2026)', () => {
    const s = makeVillage();
    const sk = s.player.core.skills;
    for (const id of Object.keys(sk)) delete sk[id];
    sk.melee_heavy = { raw: 100, state: 'normal' };
    expect(effectiveSkill(s, s.player, 'unarmed_grapple')).toMatchObject({ skill: 'melee_heavy', value: 20 });
    sk.unarmed_strike = { raw: 60, state: 'normal' };
    expect(effectiveSkill(s, s.player, 'unarmed_grapple')).toMatchObject({ skill: 'unarmed_strike', value: 24 });
    expect(effectiveSkill(s, s.player, 'unarmed_improvised')).toMatchObject({ skill: 'unarmed_strike', value: 30 }); // flat 0.5 elsewhere
  });
  it('kit pieces share one +25', () => {
    const s = makeVillage();
    s.blueprints.push({ storyId: 'test', id: 'kit_belt', kind: 'item', data: {
      id: 'kit_belt', kind: 'accessory', name: 'kit belt', look: 'a belt', bulk: 0, value: 1, slot: 'accessory',
      effects: [{ kind: 'skill', skill: 'melee_medium', value: 25, active: 'worn', scope: 'any', kit: true }] } });
    s.player.core.inventory.push({ id: 'belt', itemId: 'kit_belt', equippedIn: ['acc:0'] });
    expect(effectiveSkill(s, s.player, 'melee_medium', { itemId: sword }).value).toBe(75);
    expect(effectiveSkill(s, s.player, 'melee_medium').value).toBe(75);
  });
  it('armor weight lowers dodge', () => {
    const s = makeVillage();
    expect(effectiveSkill(s, s.player, 'dodge').value).toBe(20); // 25 − 5 gambeson
  });
});

describe('body', () => {
  it('total HP and the health track', () => {
    const s = makeVillage();
    expect(totalHp(s, s.player)).toBe(90); // endurance 40
    expect(totalHp(s, actor(s, 'slime_1'))).toBe(30);
    const lv = (pct: number) => { s.player.core.condition.hpLostPct = pct; return healthLevel(s.player); };
    expect([0, 10, 16, 45, 46, 75, 76, 99.5, 100].map(lv)).toEqual(['Unhurt', 'Bruised', 'Hurt', 'Injured', 'Wounded', 'Mauled', 'Critical', 'Critical', 'Incapacitated']);
  });
  it('builds the spec hit tables and rebuilds without a Destroyed part', () => {
    const s = makeVillage();
    const ranges = (a: Actor) => hitTable(s, a).map((r) => `${r.part}:${r.from}-${r.to}`);
    expect(ranges(s.player)).toEqual(['head:1-7', 'left_arm:8-22', 'right_arm:23-37', 'left_leg:38-52', 'right_leg:53-67', 'neck:68-70', 'general:71-100']);
    const dragon = { ...s.player, core: { ...s.player.core, creatureTypeId: 'dragon', condition: { hpLostPct: 0, parts: {}, status: [] } } };
    expect(ranges(dragon)).toEqual(['head:1-9', 'left_wing:10-18', 'right_wing:19-27', 'forelegs:28-36', 'hind_legs:37-46', 'tail:47-51', 'general:52-100']);
    s.player.core.condition.parts.left_arm = -100;
    expect(hitTable(s, s.player).map((r) => r.part)).not.toContain('left_arm');
    expect(hitTable(s, s.player).at(-1)!.to).toBe(100);
    expect(ranges(actor(s, 'slime_1'))).toEqual(['general:1-100']);
  });
  it('wounds: level plus role penalties, shared roles split, per-limb for the item hand', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 20; // Hurt −5
    s.player.core.condition.parts.right_arm = 40; // Damaged (sword arm)
    expect(woundsMods(s, s.player, 'melee_medium', { itemId: sword }).map((m) => m.value)).toEqual([-5, -10]);
    expect(woundsMods(s, s.player, 'melee_medium').map((m) => m.value)).toEqual([-5]); // best arm without an item
    expect(woundsMods(s, s.player, 'persuasion').map((m) => m.value)).toEqual([-5]);
    const dragon = { ...s.player, core: { ...s.player.core, creatureTypeId: 'dragon', condition: { hpLostPct: 0, parts: { forelegs: 40 }, status: [] } } };
    expect(woundsMods(s, dragon, 'dodge')).toEqual([{ source: 'move wounds', type: 'wounds', value: -5 }]);
    s.player.core.condition.parts.head = -10; // Sense Crippled: every roll
    expect(woundsMods(s, s.player, 'persuasion').map((m) => m.value)).toEqual([-5, -20]);
  });
});

describe('ruleset methods', () => {
  it('attack does not mutate state; applyEffects damages part and health track', () => {
    const s = makeVillage();
    const before = JSON.stringify(s);
    // player 50 → Success; patron dodge 30 → Failure: gap −2; location 20 → left arm
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false }, s, forcedRng([50, 30, 20]));
    expect(JSON.stringify(s)).toBe(before);
    expect(r).toMatchObject({ location: 'left_arm', damage: 25, outcome: 'full_hit', modeId: 'cut' });
    const fx = ruleset.applyEffects(r, s);
    const p = actor(s, 'patron_1'); // 50 HP, arm pool 15
    expect(p.core.condition.parts.left_arm).toBeCloseTo(100 - (25 / 15) * 100);
    expect(p.core.condition.hpLostPct).toBe(50);
    expect(fx).toEqual([
      { kind: 'part_state_changed', actorId: 'patron_1', data: { part: 'left_arm', from: 'Healthy', to: 'Crippled' } },
      { kind: 'threshold_crossed', actorId: 'patron_1', data: { who: 'patron_1', from: 'Unhurt', to: 'Wounded' } },
    ]);
  });
  it('a Destroyed arm drops its item; a Destroyed essential part sets HP to 0', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'tav_common');
    g.core.condition.parts.right_arm = -90;
    const hit = { attack: null as never, defense: null, defenseType: null, gap: -3, gapShifts: [], outcome: 'full_hit' as const, locationHow: 'aimed' as const,
      multiplier: 1, deciding: { attack: [], defense: [], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: sword, modeId: 'cut' };
    const fx = ruleset.applyEffects({ ...hit, location: 'right_arm', damage: 5 }, s);
    expect(fx.map((e) => e.kind)).toContain('item_dropped');
    expect(g.core.inventory.some((i) => i.itemId === 'arming_sword')).toBe(false);
    const dropped = s.zones.find((z) => z.id === 'tav_common')!.groundItems;
    expect(dropped.map((i) => i.itemId)).toEqual(['arming_sword']);
    expect(dropped[0].equippedIn).toBeUndefined();
    g.core.condition.parts.neck = -95;
    ruleset.applyEffects({ ...hit, location: 'neck', damage: 1 }, s);
    expect(g.core.condition.hpLostPct).toBe(100);
    expect(healthLevel(g)).toBe('Incapacitated');
  });
  it('checks and contests: applyEffects returns []; recordUse only logs', () => {
    const s = makeVillage();
    const c = ruleset.contested(
      { actorId: 'player', skill: 'sight', modifiers: [{ source: 'aim', type: 'aim', value: -40 }], tierShifts: [] },
      { actorId: 'patron_1', skill: 'sight', modifiers: [], tierShifts: [] }, s, forcedRng([50, 90]));
    expect(c.a.modifiers).toEqual([]); // no aim in contests
    expect(c.gap).toBe(tierLevel(c.b) - tierLevel(c.a));
    expect(c.winner).toBe('b');
    const before = JSON.stringify(s);
    expect(ruleset.applyEffects(c, s)).toEqual([]);
    expect(JSON.stringify(s)).toBe(before);
    ruleset.recordUse(s.player, 'sight', c, s);
    expect(s.log).toEqual([{ turn: 1, code: 'skill_use', detail: { actorId: 'player', skill: 'sight' } }]);
    expect(ruleset.initiative(s.player, s, forcedRng([42]))).toBe(42);
  });
  it('outnumbered, unaware and missile modifiers on the defense', () => {
    const s = makeVillage();
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false,
      context: { defensesThisTurn: 1, defenderUnaware: true } }, s, forcedRng([60, 50, 80]));
    expect(r.defense!.modifiers.map((m) => m.source)).toEqual(['outnumbered', 'unaware']);
  });
  it('morale: fearless never checks, Critical always breaks, Critical Failure surrenders', () => {
    const s = makeVillage();
    expect(moraleCheck(s, actor(s, 'slime_1'), forcedRng([1]), 'level')).toBe('steady');
    const p = actor(s, 'patron_1'); // timid 30
    expect(moraleCheck(s, p, forcedRng([90]), 'bandmate_down')).toBe('steady'); // 90 + 15 − 63.5 → Great Success
    expect(moraleCheck(s, p, forcedRng([10]), 'bandmate_down')).toBe('broken'); // −38.5 → Failure
    expect(moraleCheck(s, p, forcedRng([1]), 'bandmate_down')).toBe('surrendered'); // Failure, natural 01 → below Critical Failure
    p.core.condition.hpLostPct = 80;
    expect(moraleCheck(s, p, forcedRng([100]), 'level')).toBe('broken'); // reaching Critical always breaks
    expect(moraleCheck(s, s.player, forcedRng([1]), 'level')).toBe('steady'); // the player never checks
  });
  it('modes: held first, natural after; default by reach', () => {
    const s = makeVillage();
    expect(usableModes(s, s.player).map((m) => `${m.itemId}/${m.mode.id}`)).toEqual([`${sword}/cut`, 'natural:punch/punch', 'natural:grapple/grapple']);
    expect(defaultMode(s, s.player, 0)!.mode.id).toBe('cut');
    expect(defaultMode(s, s.player, 1)).toBeNull();
    s.player.core.condition.parts.right_arm = -10; // Crippled sword arm: no sword attack
    expect(usableModes(s, s.player).map((m) => m.mode.id)).toEqual(['punch', 'grapple']);
  });
});
