// 125 All-50 parts (Ali, 08/11/2026, All-50 doc round 1): a tree's built parts are granted free when every skill of the
// tree reaches 50 true skill, with the tree's mastery achievement; then the first six built parts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fit, forcedRng, makeVillage, place } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { grantAllSteps, shareSpotted } from '../../src/ruleset/allSteps';
import { breakFree } from '../../src/engine/held';
import { resolveSpeech } from '../../src/engine/speech';
import { situational } from '../../src/ruleset/gear';
import { achievementName } from '../../src/engine';
import { zoneById } from '../../src/engine/relations';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const set = (a: Actor, skills: string[], raw: number) => { for (const k of skills) a.core.skills[k] = { raw, state: 'normal' }; };
const arm = (s: GameState, id: string, itemId = 'dagger') => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
  fit(a, itemId); // equip requirements: tests here are about perks
};

describe('125 All-50 parts', () => {
  it('every skill of the tree at 50 grants its built parts and the mastery achievement, once', () => {
    const s = makeVillage();
    const p = s.player;
    set(p, ['melee_light', 'melee_medium'], 50);
    set(p, ['melee_heavy'], 49);
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.source === 'mastery')).toBe(false);
    set(p, ['melee_heavy'], 50);
    grantAllSteps(s, p);
    grantAllSteps(s, p);
    const got = p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId);
    expect(got).toEqual(['opening_strike', 'counter', 'fighters_frame', 'steady_guard']);
    const ach = p.progression!.achievements!.filter((a) => a.key === 'mastery_50');
    expect(ach.map((a) => a.id)).toEqual(['mastery_50:melee']);
    expect(achievementName(s, ach[0])).toBe('Adept of Combat – Arms');
  });
  it("Hunter's Eye: +10 true skill in every skill with the sight function", () => {
    const s = makeVillage();
    set(s.player, ['sight', 'hearing'], 30);
    give(s.player, 'hunters_eye');
    expect(trueSkill(s.player, 'sight')).toBe(40);
    expect(trueSkill(s.player, 'hearing')).toBe(30);
  });
  it("Fighter's Frame: melee hits on the owner deal ×0.9 damage before armor", () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, 'fighters_frame');
      return ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    expect(dmg(false)).toBeGreaterThan(0);
    expect(dmg(true)).toBeCloseTo(dmg(false) * 0.9);
  });
  it('Past the Cover: cover counts one step lighter for the owner\'s ranged attacks', () => {
    const gap = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_edge');
      zoneById(s, 'field_mid')!.cover = 'heavy';
      arm(s, 'player', 'shortbow');
      if (perk) give(s.player, 'past_the_cover');
      return ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50])).gapShifts;
    };
    expect(gap(false)).toEqual([{ source: 'cover', value: 2 }]);
    expect(gap(true)).toEqual([{ source: 'cover', value: 1 }]);
  });
  it('Child of Night: light counts one step darker for the owner\'s stealth rolls only', () => {
    const s = makeVillage();
    const zone = zoneById(s, s.player.zone)!;
    zone.light = 'dim';
    delete (zone as { outdoor?: true }).outdoor;
    const mod = (skill: string) => situational(s, skill, { light: zone, actor: s.player }).modifiers[0]?.value ?? 0;
    const before = [mod('sneaking'), mod('sight')];
    give(s.player, 'child_of_night');
    expect(before).toEqual([5, -5]);
    expect([mod('sneaking'), mod('sight')]).toEqual([10, -5]); // dim read as dark for sneaking; sight unchanged
  });
  it('Curiouser and Curiouser: an Eyesight or Earshot roll at Success or better counts one tier higher', () => {
    const s = makeVillage();
    set(s.player, ['sight', 'persuasion'], 50);
    give(s.player, 'curiouser');
    const r = (skill: string, d: number) => ruleset.roll({ actorId: 'player', skill, modifiers: [], tierShifts: [] }, s, forcedRng([d]));
    expect(r('sight', 90).tierShifts).toEqual([{ source: 'Curiouser and Curiouser', value: 1 }]);
    expect(r('sight', 10).tierShifts).toEqual([]); // not a Success
    expect(r('persuasion', 90).tierShifts).toEqual([]); // not a sense roll
  });
  it('Iron Knuckles: unarmed hits deal ×1.1 damage before armor', () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      for (const i of s.player.core.inventory) delete i.equippedIn;
      const foe = s.actors.find((a) => a.id === 'patron_1')!;
      foe.core.inventory = foe.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, 'iron_knuckles');
      return ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'unarmed', modeId: 'punch', targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    expect(dmg(false)).toBeGreaterThan(0);
    expect(dmg(true)).toBeCloseTo(dmg(false) * 1.1);
  });
  it('Bare-Handed Guard: +5 true Dodge always, +5 effective on Dodge rolls only while holding no weapon', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    set(s.player, ['dodge'], 30);
    give(s.player, 'bare_handed_guard');
    expect(trueSkill(s.player, 'dodge')).toBe(35);
    s.player.core.standingDefense = 'dodge';
    for (const i of s.player.core.inventory) delete i.equippedIn;
    const guard = () => ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50]))
      .defense!.modifiers.filter((m) => m.source === 'Bare-Handed Guard');
    expect(guard()).toEqual([{ source: 'Bare-Handed Guard', type: 'roll_perk', value: 2.5 }]);
    arm(s, 'player');
    expect(guard()).toEqual([]);
  });
  it('Hard to Hold: the owner\'s break-free roll gets tier shift +1', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    s.player.heldBy = 'patron_1';
    give(s.player, 'hard_to_hold');
    const spy = vi.spyOn(ruleset, 'roll');
    breakFree(s, s.player, forcedRng([50, 50]));
    expect(spy.mock.calls[0][0].tierShifts).toEqual([{ source: 'Hard to Hold', value: 1 }]);
    expect(spy.mock.calls[1][0].tierShifts).toEqual([]);
    spy.mockRestore();
  });
  it('Soft Landing: a speech roll at Near Miss or worse counts one tier higher; Success is unchanged', () => {
    const s = makeVillage();
    set(s.player, ['persuasion', 'sight'], 40);
    give(s.player, 'soft_landing');
    const r = (skill: string, d: number) => ruleset.roll({ actorId: 'player', skill, modifiers: [], tierShifts: [] }, s, forcedRng([d]));
    expect(r('persuasion', 2).tierShifts).toEqual([{ source: 'Soft Landing', value: 1 }]);
    expect(r('persuasion', 95).tierShifts).toEqual([]);
    expect(r('sight', 2).tierShifts).toEqual([]);
  });
  it('Spotter: band-mates in the owner\'s zone become suspicious of what the owner is aware of', () => {
    const s = makeVillage();
    const [o, mate] = s.actors.filter((a) => a.mind && a.bandId && s.actors.filter((b) => b.bandId === a.bandId).length > 1).slice(0, 1)
      .flatMap((a) => s.actors.filter((b) => b.bandId === a.bandId).slice(0, 2));
    place(s, mate.id, o.zone);
    place(s, 'player', o.zone);
    o.mind!.knowledge.player = { ...(o.mind!.knowledge.player ?? {}), status: 'aware' } as never;
    mate.mind!.knowledge.player = { ...(mate.mind!.knowledge.player ?? {}), status: 'unaware' } as never;
    shareSpotted(s, o);
    expect(mate.mind!.knowledge.player.status).toBe('unaware');
    give(o, 'spotter');
    shareSpotted(s, o);
    expect(mate.mind!.knowledge.player.status).toBe('suspicious');
    expect(mate.mind!.knowledge.player.source).toBe('told');
  });
  it('Steady Guard: +5 true Block always, +5 effective on Block rolls made with a melee weapon', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    arm(s, 'player');
    set(s.player, ['block'], 30);
    give(s.player, 'steady_guard');
    expect(trueSkill(s.player, 'block')).toBe(35);
    s.player.core.standingDefense = 'block';
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50]));
    expect(r.defense!.modifiers.filter((m) => m.source === 'Steady Guard')).toEqual([{ source: 'Steady Guard', type: 'roll_perk', value: 2.5 }]);
  });
  it('Thick Hide: health lost from a hit is ×0.95, after armor', () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      if (perk) give(s.player, 'thick_hide');
      return ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    expect(dmg(false)).toBeGreaterThan(0);
    expect(dmg(true)).toBeCloseTo(dmg(false) * 0.95);
  });
  it('Night Eyes: light counts one step brighter for the owner\'s Eyesight rolls only', () => {
    const s = makeVillage();
    const zone = zoneById(s, s.player.zone)!;
    zone.light = 'dark';
    delete (zone as { outdoor?: true }).outdoor;
    const mod = (skill: string) => situational(s, skill, { light: zone, actor: s.player }).modifiers[0]?.value ?? 0;
    const before = [mod('sight'), mod('sneaking')];
    give(s.player, 'night_eyes');
    expect([mod('sight'), mod('sneaking')]).toEqual([situational(s, 'sight', { light: { ...zone, light: 'dim' } }).modifiers[0]?.value ?? 0, before[1]]);
    expect(mod('sight')).toBeGreaterThan(before[0]);
  });
  it('Dodgy: attack rolls against the owner get −5 effective skill', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    give(s.player, 'dodgy');
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.attack.modifiers.filter((m) => m.type === 'foe_perk')).toEqual([{ source: 'Dodgy', type: 'foe_perk', value: -2.5 }]);
  });
});

describe('125 All-50 moves', () => {
  afterEach(() => vi.restoreAllMocks());
  /** the player attacks `target` with `weapon`; `shape` rewrites the player's first attack result; returns every attack made */
  const fight = (s: GameState, target: string, weapon: string, shape: (r: AttackResult) => AttackResult) => {
    const calls: { by: string; at: string }[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => {
      calls.push({ by: req.attackerId, at: req.targetId });
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      return calls.length === 1 ? shape(r) : r;
    });
    play(s, { intent: intent({ action: { type: 'attack', target, item: weapon } }) });
    return calls;
  };
  const fumble = (r: AttackResult) => ({ ...r, attack: { ...r.attack, tier: 'critical_failure' as const }, outcome: 'missed' as const, damage: 0, location: null });
  it('Counter: a melee attack on the owner that ends in Critical Failure earns one free attack back', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    arm(s, 'patron_1');
    give(s.actors.find((a) => a.id === 'patron_1')!, 'counter');
    expect(fight(s, 'patron_1', 'w_player', fumble).slice(0, 2)).toEqual([{ by: 'player', at: 'patron_1' }, { by: 'patron_1', at: 'player' }]);
    const t = makeVillage();
    place(t, 'patron_1', t.player.zone);
    arm(t, 'player');
    arm(t, 'patron_1');
    expect(fight(t, 'patron_1', 'w_player', fumble).filter((c) => c.by === 'patron_1' && c.at === 'player').length).toBeLessThanOrEqual(1); // only its own turn's attack, if any
    const u = makeVillage();
    place(u, 'patron_1', u.player.zone);
    arm(u, 'player');
    arm(u, 'patron_1');
    give(u.actors.find((a) => a.id === 'patron_1')!, 'counter');
    const plain = fight(u, 'patron_1', 'w_player', (r) => ({ ...r, attack: { ...r.attack, tier: 'failure' as const }, outcome: 'missed' as const, damage: 0, location: null }));
    expect(plain[1]).not.toEqual({ by: 'patron_1', at: 'player' }); // a plain Failure gives nothing at once
  });
  it('Second Wind: once per engagement, at Wounded or worse the health track moves one level better', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    give(foe, 'second_wind');
    foe.core.condition.hpLostPct = 50; // Wounded
    const graze = (r: AttackResult) => ({ ...r, outcome: 'grazed' as const, location: 'general', damage: 0.01 });
    fight(s, 'patron_1', 'w_player', graze);
    expect(foe.core.condition.hpLostPct).toBeLessThanOrEqual(45); // Injured at most
    expect(foe.engagement?.uses?.second_wind).toBe(1);
  });
  it('Strike and Fade: right after an attack from hiding the owner is stealthy again and vanishes in place', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    give(s.player, 'strike_and_fade');
    s.player.posture = 'stealthy';
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    const fade = ev.find((e) => e.actorId === 'player' && e.kind === 'hide' && e.vanish);
    expect(fade?.effects.map((f) => f.kind)).toContain('strike_and_fade');
    expect(s.log.some((l) => l.code === 'stealth_contest' && (l.detail as { skill: string }).skill === 'vanishing')).toBe(true);
  });
  it('Volley: once per engagement, a ranged hit is followed by a free shot at a foe already hostile and known', () => {
    const run = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_mid');
      place(s, 'slime_2', 'field_mid');
      arm(s, 'player', 'shortbow');
      if (perk) give(s.player, 'volley');
      const hit = (r: AttackResult) => ({ ...r, outcome: 'full_hit' as const, location: 'general', damage: 0.01 });
      return { s, calls: fight(s, 'slime_1', 'w_player', hit).filter((c) => c.by === 'player') };
    };
    expect(run(false).calls.length).toBe(1);
    const { s, calls } = run(true);
    expect(calls.length).toBe(2);
    expect(['slime_1', 'slime_2']).toContain(calls[1].at);
    expect(s.player.engagement?.uses?.volley).toBe(1);
  });
  it('Opening Strike: the first melee attack on each foe in an engagement gets tier shift +1', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    give(s.player, 'opening_strike');
    const shifts: unknown[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => { if (req.attackerId === 'player') shifts.push(req.context?.attackerShifts); return real(req, st, rng); });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    expect(shifts[0]).toEqual([{ source: 'Opening Strike', value: 1 }]);
    expect(shifts[1]).toBeUndefined();
  });
  it('Unerring: the first ranged attack in an engagement, at a foe that hasn\'t acted, gives its defense roll tier shift −1', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    arm(s, 'player', 'shortbow');
    give(s.player, 'unerring');
    const shifts: unknown[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => { if (req.attackerId === 'player') shifts.push(req.context?.defenderShifts); return real(req, st, rng); });
    play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1', item: 'w_player' } }) });
    play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1', item: 'w_player' } }) });
    expect(shifts[0]).toEqual([{ source: 'Unerring', value: -1 }]);
    expect(shifts[1]).toBeUndefined();
  });
  it('Hushed Steps: a Near Miss asked to count higher becomes a Success', () => {
    const s = makeVillage();
    set(s.player, ['sneaking'], 40);
    const r = (d: number, up?: string) => ruleset.roll({ actorId: 'player', skill: 'sneaking', modifiers: [], tierShifts: [], ...(up ? { nearMissUp: up } : {}) }, s, forcedRng([d]));
    const d = [...Array(100).keys()].map((i) => i + 1).find((x) => r(x).tier === 'near_miss')!;
    expect(r(d, 'Hushed Steps').tier).toBe('success');
    expect(r(d, 'Hushed Steps').tierShifts).toEqual([{ source: 'Hushed Steps', value: 1 }]);
  });
});

describe('125 All-50 Easy Speaker', () => {
  it('a listener with Easy Speaker answers the player\'s speech one outcome better', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    const spy = vi.spyOn(ruleset, 'roll');
    const shiftsOf = () => spy.mock.calls.filter((c) => c[0].actorId === 'patron_1').map((c) => c[0].tierShifts);
    resolveSpeech(s, intent({ action: { type: 'persuade', target: 'patron_1' } }), ['patron_1'], forcedRng([50, 50]));
    expect(shiftsOf()).toEqual([[]]);
    spy.mockClear();
    give(foe, 'easy_speaker');
    resolveSpeech(s, intent({ action: { type: 'persuade', target: 'patron_1' } }), ['patron_1'], forcedRng([50, 50]));
    expect(shiftsOf()).toEqual([[{ source: 'Easy Speaker', value: 1 }]]);
    spy.mockRestore();
  });
});
