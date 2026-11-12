import { AM } from '../../src/library/tableIds';
import { BT } from '../../src/library/raceIds';
import { TIERS } from '../../src/scales';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, actor, forcedRng, createRng } from '../harness';
import {
  band, defaultMode, effectiveSkill, healthLevel, hitTable, moraleRoll, ruleset, stackType, totalHp, usableModes, woundsMods,
  tierLevel,
} from '../../src/ruleset';
import type { Actor } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { FN, GR } from '../../src/library/functionIds';
import { groupsOf } from '../../src/library/functionNames';
import { kitBonus } from '../../src/ruleset/gear';
import { maxMorale, moraleLevel, restoreMorale, tierCostMult } from '../../src/ruleset/morale';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';

const sword = `player_${IT.arming_sword}_1`;

describe('ruleset maths', () => {
  it('stacks within a type (Part 1 §4 example)', () => {
    expect(stackType([6, 4, 2])).toBe(8.5);
    expect(stackType([-8, -3])).toBe(-9.5);
    expect(stackType([6, 4, 2, -8, -3])).toBe(-1);
    expect(stackType([8, 8, 8, 8, 8])).toBe(15.5); // 8 + 4 + 2 + 1 + 0.5: the x-th counts at 0.5^(x−1)
  });
  it('bands margins exactly, .5 included', () => {
    expect([-75.5, -75, -26, -25.5, -25, -0.5, 0, 24.5, 25, 74.5, 75].map((m) => TIERS.at(band(m)))).toEqual(
      ['critical_failure', 'failure', 'failure', 'failure', 'near_miss', 'near_miss', 'success', 'success', 'great_success', 'great_success', 'critical_success']);
  });
  it('stand-ins at SUBSTITUTE_EFFICIENCY (0.3, F4), highest candidate', () => {
    const s = makeVillage();
    s.player.core.skills[SK.intimidation] = { raw: 20, state: 'normal' };
    s.player.core.skills[SK.persuasion] = { raw: 100, state: 'normal' };
    expect(effectiveSkill(s, s.player, SK.intimidation)).toMatchObject({ skill: SK.persuasion, value: 30 });
    const c = ruleset.check({ actorId: 'player', skill: SK.intimidation, modifiers: [{ source: 'x', value: 20 }] }, s, createRng(1));
    expect(c).toMatchObject({ skill: SK.persuasion, target: 50, passed: true });
  });
  it('grapple substitutes: other unarmed 0.4×, melee 0.2×', () => {
    const s = makeVillage();
    const sk = s.player.core.skills;
    for (const id of Object.keys(sk)) delete sk[id];
    sk[SK.melee_heavy] = { raw: 100, state: 'normal' };
    expect(effectiveSkill(s, s.player, SK.unarmed_grapple)).toMatchObject({ skill: SK.melee_heavy, value: 20 });
    sk[SK.unarmed_strike] = { raw: 60, state: 'normal' };
    expect(effectiveSkill(s, s.player, SK.unarmed_grapple)).toMatchObject({ skill: SK.unarmed_strike, value: 24 });
    expect(effectiveSkill(s, s.player, SK.unarmed_improvised)).toMatchObject({ skill: SK.unarmed_strike, value: 18 }); // flat 0.3 elsewhere (F4)
  });
  it('a kit piece gives EQUIP_FACTOR × its need', () => {
    const lib = getLibrary();
    const bonus = (id: string) => kitBonus(lib.items[id], lib.items[id].effects!.find((e) => e.kit)!);
    expect(CONFIG.EQUIP_FACTOR).toBe(0.4);
    expect([IT.cudgel, IT.dagger, IT.round_shield, IT.arming_sword, IT.greataxe].map(bonus)).toEqual([0, 10, 10, 20, 30]);
    const minted = { ...lib.items[IT.arming_sword], base: { itemId: IT.arming_sword, quality: 'quality_3' as const, boosts: 'hitAdj' } };
    expect(kitBonus(minted, minted.effects![0])).toBe(30); // quality 3: one level up (superior, need 75)
  });
  it('kit pieces share one bonus, the best of them', () => {
    const s = makeVillage();
    s.blueprints.push({ storyId: 'test', id: 'kit_belt', kind: 'item', data: {
      id: 'kit_belt', kind: 'accessory', name: 'kit belt', look: 'a belt', bulk: 0, value: 1, slot: 'accessory',
      effects: [{ kind: 'skill', skill: SK.melee_medium, value: 25, active: 'worn', scope: 'any', kit: true }] } });
    s.player.core.inventory.push({ id: 'belt', itemId: 'kit_belt', equippedIn: ['acc:0'] });
    expect(effectiveSkill(s, s.player, SK.melee_medium, { itemId: sword }).value).toBe(75);
    expect(effectiveSkill(s, s.player, SK.melee_medium).value).toBe(75);
  });
  it('armor weight lowers dodge', () => {
    const s = makeVillage();
    expect(effectiveSkill(s, s.player, SK.dodge).value).toBe(20); // 25 − 5 gambeson
  });
});

describe('body', () => {
  it('total HP and the health track', () => {
    const s = makeVillage();
    expect(totalHp(s, s.player)).toBe(90); // endurance 40
    expect(totalHp(s, actor(s, 'slime_1'))).toBe(30);
    const lv = (pct: number) => { s.player.core.condition.hpLostPct = pct; return healthLevel(s.player); };
    expect([0, 10, 16, 45, 46, 75, 76, 99.5, 100, 149.5, 150].map(lv)).toEqual(['unhurt', 'bruised', 'hurt', 'injured', 'wounded', 'mauled', 'critical', 'critical', 'incapacitated', 'incapacitated', 'dead']);
  });
  it('builds the spec hit tables and rebuilds without a Destroyed part', () => {
    const s = makeVillage();
    const ranges = (a: Actor) => hitTable(s, a).map((r) => `${r.part}:${r.from}-${r.to}`);
    expect(ranges(s.player)).toEqual(['head:1-7', 'left_arm:8-22', 'right_arm:23-37', 'left_leg:38-52', 'right_leg:53-67', 'neck:68-70', 'general:71-100']);
    const dragon = { ...s.player, core: { ...s.player.core, bodyTypeId: BT.winged_quadruped, condition: { hpLostPct: 0, parts: {}, status: [] } } };
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
    expect(woundsMods(s, s.player, SK.melee_medium, { itemId: sword }).map((m) => m.value)).toEqual([-5, -10]);
    expect(woundsMods(s, s.player, SK.melee_medium).map((m) => m.value)).toEqual([-5]); // best arm without an item
    expect(woundsMods(s, s.player, SK.persuasion).map((m) => m.value)).toEqual([-5]);
    const dragon = { ...s.player, core: { ...s.player.core, bodyTypeId: BT.winged_quadruped, condition: { hpLostPct: 0, parts: { forelegs: 40 }, status: [] } } };
    expect(woundsMods(s, dragon, SK.dodge)).toEqual([{ source: 'move wounds', type: 'wounds', value: -5 }]);
    s.player.core.condition.parts.head = 40; // Damaged head: speech rolls only
    expect(woundsMods(s, s.player, SK.persuasion)).toContainEqual({ source: 'speech wounds', type: 'wounds', value: -10 });
    expect(woundsMods(s, s.player, SK.dodge).map((m) => m.value)).toEqual([-5]);
    s.player.core.condition.parts.head = -10; // Sense Crippled: every roll, plus speech on speech rolls
    expect(woundsMods(s, s.player, SK.persuasion).map((m) => m.value)).toEqual([-5, CONFIG.ESSENTIAL_CRIPPLED_PENALTY, -20, -20]); // a crippled head is an essential part too
  });
});

describe('ruleset methods', () => {
  it('attack does not mutate state; applyEffects damages part and health track', () => {
    const s = makeVillage();
    const before = JSON.stringify(s);
    // player 50 → Success; patron dodge 30 → Failure: gap −2; location 20 → left arm
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false }, s, forcedRng([50, 30, 20]));
    expect(JSON.stringify(s)).toBe(before);
    const dmg = 25 * CONFIG.GAP_LADDER.dodge[-2]; // a dodge at gap −2 lets the blow through at its ladder multiplier
    expect(r).toMatchObject({ location: 'left_arm', damage: dmg, outcome: 'full_hit', modeId: AM.cut });
    const fx = ruleset.applyEffects(r, s);
    const p = actor(s, 'patron_1'); // 50 HP, arm pool 15
    expect(p.core.condition.parts.left_arm).toBeCloseTo(100 - (dmg / 15) * 100);
    expect(p.core.condition.hpLostPct).toBeCloseTo((dmg / 50) * 100);
    // 31.25 (25 × the −2 dodge multiplier) wrecks a 15-point arm and takes 62.5% of 50 HP
    expect(fx).toEqual([
      { kind: 'part_state_changed', actorId: 'patron_1', data: { part: 'left_arm', from: 'healthy', to: 'destroyed' } },
      { kind: 'threshold_crossed', actorId: 'patron_1', data: { who: 'patron_1', from: 'unhurt', to: 'mauled' } },
    ]);
  });
  it('a Destroyed arm drops its item; a Destroyed essential part sets HP to 0', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'tav_common');
    g.core.condition.parts.right_arm = -90;
    const hit = { attack: null as never, defense: null, defenseType: null, gap: -3, gapShifts: [], outcome: 'full_hit' as const, locationHow: 'aimed' as const,
      multiplier: 1, deciding: { attack: [], defense: [], gap: [] }, attackerId: 'player', targetId: 'guard_1', weaponId: sword, modeId: AM.cut };
    const fx = ruleset.applyEffects({ ...hit, location: 'right_arm', damage: 5 }, s);
    expect(fx.map((e) => e.kind)).toContain('item_dropped');
    expect(g.core.inventory.some((i) => i.itemId === IT.arming_sword)).toBe(false);
    const dropped = s.zones.find((z) => z.id === 'tav_common')!.groundItems;
    expect(dropped.map((i) => i.itemId)).toEqual([IT.arming_sword]);
    expect(dropped[0].equippedIn).toBeUndefined();
    g.core.condition.parts.neck = -95;
    ruleset.applyEffects({ ...hit, location: 'neck', damage: 1 }, s);
    expect(g.core.condition.hpLostPct).toBe(150);
    expect(healthLevel(g)).toBe('dead');
  });
  it('checks and contests: applyEffects returns []; recordUse only logs', () => {
    const s = makeVillage();
    const c = ruleset.contested(
      { actorId: 'player', skill: SK.eyesight, modifiers: [{ source: 'aim', type: 'aim', value: -40 }], tierShifts: [] },
      { actorId: 'patron_1', skill: SK.eyesight, modifiers: [], tierShifts: [] }, s, forcedRng([50, 90]));
    expect(c.a.modifiers).toEqual([]); // no aim in contests
    expect(c.gap).toBe(tierLevel(c.b) - tierLevel(c.a));
    expect(c.winner).toBe('b');
    const before = JSON.stringify(s);
    expect(ruleset.applyEffects(c, s)).toEqual([]);
    expect(JSON.stringify(s)).toBe(before);
    ruleset.recordUse(s.player, SK.eyesight, c, s);
    expect(s.log).toEqual([{ turn: 1, code: 'skill_use', detail: { actorId: 'player', skill: SK.eyesight } }]);
  });
  it('initiative: d100 plus the best Initiative-function skill × SKILL_WEIGHT (none yet: plain d100)', () => {
    const s = makeVillage();
    expect(ruleset.initiative(s.player, s, forcedRng([42]))).toBe(42); // Dodge is in the Speed group but has no Initiative function
    const dodge = getLibrary().skills[SK.dodge];
    const before = dodge.functions;
    dodge.functions = [...before, FN.initiative];
    try {
      const skill = effectiveSkill(s, s.player, SK.dodge, { fullValue: [SK.dodge] }).value;
      expect(skill).toBeGreaterThan(0);
      expect(ruleset.initiative(s.player, s, forcedRng([42]))).toBeCloseTo(42 + CONFIG.SKILL_WEIGHT * skill);
    } finally {
      dodge.functions = before;
    }
  });
  it('Dodge is in the Defense and Speed groups', () => {
    expect(groupsOf(getLibrary().skills[SK.dodge])).toEqual([GR.defense, GR.speed]);
  });
  it('outnumbered, unaware and missile modifiers on the defense', () => {
    const s = makeVillage();
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false,
      context: { defensesThisTurn: 1, defenderUnaware: true } }, s, forcedRng([60, 50, 80]));
    expect(r.defense!.modifiers.map((m) => m.source)).toEqual(['outnumbered', 'unaware']);
  });
  it('morale: Resolve from personality, max morale, levels, the roll scales a fear; fear feeds on itself', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1'), p = actor(s, 'patron_1'); // steady 50, timid 30
    expect(slime.core.skills[SK.resolve].raw).toBe(50);
    expect(maxMorale(p)).toBe(CONFIG.MORALE_BASE + 30);
    expect(tierLevel(moraleRoll(s, p, forcedRng([90])))).toBe(TIERS.pos('great_success')); // 90 + 15 − 63.5
    expect([1, 0, 1, 2, 5].map((l) => tierCostMult(l))).toEqual([1.5, 2, 1.5, 1, 0]);
    expect(tierCostMult(-2)).toBe(3); // two steps past Critical Failure
    p.core.condition.moraleLost = 40; // 50 % of 80: Afraid
    expect(moraleLevel(p)).toBe('afraid');
    expect(woundsMods(s, p, SK.resolve).find((m) => m.source === 'morale: Afraid')?.value).toBe(-5);
    p.core.condition.moraleLost = 80;
    expect(moraleLevel(p)).toBe('broken');
    restoreMorale(p, 25); // engagement end: back 20 of 80
    expect(p.core.condition.moraleLost).toBe(60);
    restoreMorale(p, 500);
    expect(p.core.condition.moraleLost).toBe(0);
  });
  it('modes: held first, natural after; default by reach', () => {
    const s = makeVillage();
    expect(usableModes(s, s.player).map((m) => `${m.itemId}/${m.mode.id}`)).toEqual([`${sword}/${AM.cut}`, `natural:${AM.punch}/${AM.punch}`, `natural:${AM.grapple}/${AM.grapple}`]);
    expect(defaultMode(s, s.player, 0)!.mode.id).toBe(AM.cut);
    expect(defaultMode(s, s.player, 1.6)!.mode.id).toBe(AM.cut); // the arming sword reaches 1.6 m
    expect(defaultMode(s, s.player, 1.7)).toBeNull();
    s.player.core.condition.parts.right_arm = -10; // Crippled sword arm: no sword attack
    expect(usableModes(s, s.player).map((m) => m.mode.id)).toEqual([AM.punch, AM.grapple]);
  });
});
