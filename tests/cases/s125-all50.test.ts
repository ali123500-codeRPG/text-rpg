// 125 All-50 parts (All-50 doc round 1): once three skills of a tree reach 50 true skill, the tree's passive and those
// skills' parts are granted free, with the tree's mastery achievement; a further skill at 50 adds its part. Then the built parts.
import { AM } from '../../src/library/tableIds';
import { TR } from '../../src/library/treeIds';
import { ACH } from '../../src/library/achievementIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncPerkLinks } from '../../src/ruleset/perkLinks';
import { fit, forcedRng, makeVillage, place, beside } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { grantAllSteps } from '../../src/ruleset/allSteps';
import { breakFree } from '../../src/engine/held';
import { resolveSpeech } from '../../src/engine/speech';
import { situational } from '../../src/ruleset/gear';
import { achievementName } from '../../src/engine';
import { getLibrary } from '../../src/library';
import { zoneById } from '../../src/engine/relations';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { setTitleLight } from '../../src/plan/draw';
import { LC } from '../../src/library/tableIds';
import { landUnder } from '../harness';
import { lightAll } from '../harness';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const set = (a: Actor, skills: string[], raw: number) => { for (const k of skills) a.core.skills[k] = { raw, state: 'normal' }; };
const arm = (s: GameState, id: string, itemId: string = IT.dagger) => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  fit(a, itemId); // equip requirements: tests here are about perks
};

describe('125 All-50 parts', () => {
  it('three skills of the tree at 50 grant the passive, their parts and the mastery achievement, once', () => {
    const s = makeVillage();
    const p = s.player;
    set(p, [SK.melee_light, SK.melee_medium], 50);
    set(p, [SK.melee_heavy], 49);
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.source === 'mastery')).toBe(false);
    set(p, [SK.melee_heavy], 50);
    grantAllSteps(s, p);
    grantAllSteps(s, p);
    const got = p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId);
    expect(got).toEqual([PK.fighters_frame, PK.counter, PK.steady_guard, PK.opening_strike]);
    const ach = p.progression!.achievements!.filter((a) => a.key === ACH.mastery_50);
    expect(ach.map((a) => a.id)).toEqual([`${ACH.mastery_50}:${TR.melee}`]);
    expect(achievementName(s, ach[0])).toBe('Adept of Combat – Arms');
  });
  it('only the skills at 50 bring their parts; a fourth skill at 50 later adds its own; a two-skill tree never earns it', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.perks = [];
    set(p, [SK.eyesight, SK.earshot], 50);
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.source === 'mastery')).toBe(false); // two of three
    set(p, [SK.insight], 50); // Insight has no part yet: the passive, Night Eyes and Know the Step come
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.curiouser, PK.night_eyes, PK.know_the_step]);
    const q = makeVillage().player;
    q.core.perks = [];
    set(q, [SK.melee_light, SK.melee_heavy, SK.melee_medium], 0);
    set(q, [SK.melee_light, SK.melee_heavy], 50);
    set(q, [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], 50);
    const s2 = makeVillage(); s2.player = q;
    grantAllSteps(s2, q);
    expect(q.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.hunters_eye, PK.unerring, PK.volley, PK.past_the_cover]);
    set(q, [SK.dodge, SK.block], 60); // two of Defense's three skills
    grantAllSteps(s2, q);
    expect(q.core.perks.some((x) => x.perkId === PK.dodgy || x.perkId === PK.thick_hide)).toBe(false);
    set(q, [SK.melee_medium], 50); // the third Arms skill: passive + all three parts
    grantAllSteps(s2, q);
    expect(q.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId).slice(4)).toEqual([PK.fighters_frame, PK.counter, PK.steady_guard, PK.opening_strike]);
  });
  it('a tree\'s rating sets how many skills at 50 earn it: inferior never, superior 2, legendary 1', () => {
    const s = makeVillage(), p = s.player;
    p.core.perks = [];
    const lib = getLibrary();
    set(p, [SK.eyesight, SK.earshot], 50);
    lib.trees[TR.perception].rating = 'superior';
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.curiouser, PK.night_eyes, PK.know_the_step]);
    set(p, [SK.melee_medium, SK.melee_heavy], 0);
    set(p, [SK.melee_light], 50);
    lib.trees[TR.melee].rating = 'legendary';
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId).slice(3)).toEqual([PK.fighters_frame, PK.counter]);
    set(p, [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], 50);
    lib.trees[TR.ranged].rating = 'inferior';
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.perkId === PK.hunters_eye)).toBe(false);
    expect(p.progression?.achievements?.some((a) => a.id === `${ACH.mastery_50}:${TR.ranged}`) ?? false).toBe(false);
  });
  it("Hunter's Eye: +10 true skill in every skill with the sight function", () => {
    const s = makeVillage();
    set(s.player, [SK.eyesight, SK.earshot], 30);
    give(s.player, PK.hunters_eye);
    expect(trueSkill(s.player, SK.eyesight)).toBe(40);
    expect(trueSkill(s.player, SK.earshot)).toBe(30);
  });
  it("Fighter's Frame (melee hits on the owner cost ×0.9 health, after armor) and Thick Hide (a hit on the owner is ×0.95 before armor)", () => {
    const dmg = (perk?: string) => {
      const s = makeVillage();
      beside(s, 'patron_1');
      arm(s, 'patron_1');
      s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, perk);
      return ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    const plain = dmg();
    expect(plain).toBeGreaterThan(0);
    expect(dmg(PK.fighters_frame)).toBeCloseTo(plain * 0.9);
    expect(dmg(PK.thick_hide)).toBeCloseTo(plain * 0.95);
  });
  it('Past the Cover (CV8 b): the target counts as showing four times as much to the owner\'s ranged attacks', () => {
    const gap = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_edge');
      landUnder(s, zoneById(s, 'field_mid')!.outline, LC.woods);
      arm(s, 'player', IT.shortbow);
      if (perk) give(s.player, PK.past_the_cover);
      return ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'w_player', targetPart: null, aimed: false }, s, forcedRng([100, 50, 50])).attack.modifiers.find((m) => m.source === 'cover')?.pct;
    };
    expect(gap(false)).toBe(-59);
    expect(gap(true)).toBe(-33); // two halvings back
  });
  it('Child of Night: light counts ten times darker for the owner\'s stealth rolls only', () => {
    const s = makeVillage();
    const zone = zoneById(s, s.player.zone)!;
    lightAll(s, 'dim');
    delete s.player.pos; // read the room's own light word, not the light where they stand
    const mod = (skill: string) => situational(s, skill, { light: zone, actor: s.player }).modifiers[0]?.value ?? 0;
    const before = [mod(SK.sneaking), mod(SK.eyesight)];
    give(s.player, PK.child_of_night);
    expect(before).toEqual([9, -9]); // LT2: dim, 3 lux
    expect([mod(SK.sneaking), mod(SK.eyesight)]).toEqual([16, -9]); // dim read ten times darker for sneaking; sight unchanged
  });
  it('Iron Knuckles: unarmed hits deal ×1.1 damage before armor', () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      beside(s, 'patron_1');
      for (const i of s.player.core.inventory) delete i.equippedIn;
      const foe = s.actors.find((a) => a.id === 'patron_1')!;
      foe.core.inventory = foe.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, PK.iron_knuckles);
      return ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'unarmed', modeId: AM.punch, targetPart: null, aimed: false }, s, forcedRng([99, 2, 50, 50])).damage;
    };
    expect(dmg(false)).toBeGreaterThan(0);
    expect(dmg(true)).toBeCloseTo(dmg(false) * 1.1);
  });
  it('Bare-Handed Guard: +5 true Dodge always, +5 effective on Dodge rolls only while holding no weapon', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    arm(s, 'patron_1');
    set(s.player, [SK.dodge], 30);
    give(s.player, PK.bare_handed_guard);
    expect(trueSkill(s.player, SK.dodge)).toBe(35);
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
    beside(s, 'patron_1');
    s.player.heldBy = 'patron_1';
    give(s.player, PK.hard_to_hold);
    const spy = vi.spyOn(ruleset, 'roll');
    breakFree(s, s.player, forcedRng([50, 50]));
    expect(spy.mock.calls[0][0].tierShifts).toEqual([{ source: 'Hard to Hold', value: 1 }]);
    expect(spy.mock.calls[1][0].tierShifts).toEqual([]);
    spy.mockRestore();
  });
  it('Soft Landing: a speech roll at Near Miss or worse counts one tier higher; Success is unchanged', () => {
    const s = makeVillage();
    set(s.player, [SK.persuasion, SK.eyesight], 40);
    give(s.player, PK.soft_landing);
    const r = (skill: string, d: number) => ruleset.roll({ actorId: 'player', skill, modifiers: [], tierShifts: [] }, s, forcedRng([d]));
    expect(r(SK.persuasion, 2).tierShifts).toEqual([{ source: 'Soft Landing', value: 1 }]);
    expect(r(SK.persuasion, 95).tierShifts).toEqual([]);
    expect(r(SK.eyesight, 2).tierShifts).toEqual([]);
  });
  it('Dodgy: attack rolls against the owner get −10 effective skill', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    arm(s, 'patron_1');
    give(s.player, PK.dodgy);
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.attack.modifiers.filter((m) => m.type === 'foe_perk')).toEqual([{ source: 'Dodgy', type: 'foe_perk', value: -5 }]);
  });
});

describe('125 All-50 moves', () => {
  afterEach(() => vi.restoreAllMocks());
  /** the player attacks `target` with `weapon`; `shape` rewrites the player's first attack result; returns every attack made */
  const fight = (s: GameState, target: string, weapon: string, shape: (r: AttackResult) => AttackResult, everyBlow = false) => {
    const calls: { by: string; at: string }[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => {
      calls.push({ by: req.attackerId, at: req.targetId });
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      return calls.length === 1 || (everyBlow && req.attackerId === 'player') ? shape(r) : r; // AT78: the player's turn holds two blows
    });
    play(s, { intent: intent({ action: { type: 'attack', target, item: weapon } }) });
    return calls;
  };
  const fumble = (r: AttackResult) => ({ ...r, attack: { ...r.attack, tier: 'critical_failure' as const }, outcome: 'missed' as const, damage: 0, location: null });
  it('Counter: a melee attack on the owner that ends in Critical Failure earns one free attack back', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    arm(s, 'player');
    arm(s, 'patron_1');
    give(s.actors.find((a) => a.id === 'patron_1')!, PK.counter);
    expect(fight(s, 'patron_1', 'w_player', fumble).slice(0, 2)).toEqual([{ by: 'player', at: 'patron_1' }, { by: 'patron_1', at: 'player' }]);
    const u = makeVillage();
    place(u, 'patron_1', u.player.zone);
    arm(u, 'player');
    arm(u, 'patron_1');
    give(u.actors.find((a) => a.id === 'patron_1')!, PK.counter);
    const plain = fight(u, 'patron_1', 'w_player', (r) => ({ ...r, attack: { ...r.attack, tier: 'failure' as const }, outcome: 'missed' as const, damage: 0, location: null }));
    expect(plain[1]).not.toEqual({ by: 'patron_1', at: 'player' }); // a plain Failure gives nothing at once
  });
  it('Counter comes once per round by default; Endless Answer lifts the limit (D-337)', () => {
    const counters = (endless: boolean) => {
      const s = makeVillage();
      beside(s, 'patron_1');
      arm(s, 'patron_1');
      for (const i of s.player.core.inventory) delete i.equippedIn; // bare hands: Flurry's free strike lands in the same round
      give(s.player, PK.flurry);
      const p = s.actors.find((a) => a.id === 'patron_1')!;
      give(p, PK.counter);
      if (endless) { give(p, PK.every_answer); give(p, PK.ceaseless_guard); syncPerkLinks(p, 0); }
      const calls: { by: string; at: string }[] = [];
      const real = ruleset.attack;
      vi.spyOn(ruleset, 'attack').mockImplementation((req, st) => {
        calls.push({ by: req.attackerId, at: req.targetId });
        const r = real(req, st, forcedRng([50, 50, 50, 50]));
        return req.attackerId === 'player' ? fumble(r) : r;
      });
      play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }) });
      vi.restoreAllMocks();
      // the Counters come at once, before anything else the patron does: the run of its blows right after the player's two
      const first = calls.findIndex((c) => c.by === 'patron_1');
      expect(calls.slice(0, first).filter((c) => c.by === 'player').length).toBeGreaterThanOrEqual(2);
      return calls.slice(first).findIndex((c) => c.by !== 'patron_1') === -1 ? calls.length - first : calls.slice(first).findIndex((c) => c.by !== 'patron_1');
    };
    expect(counters(true)).toBe(counters(false) + 1); // two fumbles in one round: one Counter by default, two with no limit
  });
  it('Second Wind: once per engagement, at Wounded or worse the health track moves one level better', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    arm(s, 'player');
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    give(foe, PK.second_wind);
    foe.core.condition.hpLostPct = 50; // Wounded
    const graze = (r: AttackResult) => ({ ...r, outcome: 'grazed' as const, location: 'general', damage: 0.01 });
    fight(s, 'patron_1', 'w_player', graze, true);
    expect(foe.core.condition.hpLostPct).toBeLessThanOrEqual(45.05); // Injured at most (the second graze adds a hair)
    expect(foe.engagement?.uses?.[PK.second_wind]).toBe(1);
  });
  it('Volley: once per engagement, a ranged hit is followed by a free shot at a foe already hostile and known', () => {
    const run = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_mid');
      place(s, 'slime_2', 'field_mid');
      arm(s, 'player', IT.shortbow);
      if (perk) give(s.player, PK.volley);
      const hit = (r: AttackResult) => ({ ...r, outcome: 'full_hit' as const, location: 'general', damage: 0.01 });
      return { s, calls: fight(s, 'slime_1', 'w_player', hit, true).filter((c) => c.by === 'player') }; // every shot a scratch, so no slime falls before the turn's second shot
    };
    const plain = run(false).calls.length; // TP9: a 3 s light bow shot repeats in a 6 s turn (AT78)
    const { s, calls } = run(true);
    expect(calls.length).toBe(plain + 1);
    expect(['slime_1', 'slime_2']).toContain(calls[1].at);
    expect(s.player.engagement?.uses?.[PK.volley]).toBe(1);
  });
  it('Opening Strike: the first melee attack on each foe in an engagement gets tier shift +1', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    arm(s, 'player');
    give(s.player, PK.opening_strike);
    const shifts: unknown[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => { if (req.attackerId === 'player') shifts.push(req.context?.attackerShifts); return real(req, st, rng); });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    expect(shifts[0]).toEqual([{ source: 'Opening Strike', value: 1 }]);
    expect(shifts[1]).toBeUndefined();
  });
});

describe('125 All-50 Easy Speaker', () => {
  it('a listener with Easy Speaker answers the player\'s speech one outcome better', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    const spy = vi.spyOn(ruleset, 'roll');
    const shiftsOf = () => spy.mock.calls.filter((c) => c[0].actorId === 'patron_1').map((c) => c[0].tierShifts);
    resolveSpeech(s, intent({ action: { type: 'persuade', target: 'patron_1' } }), ['patron_1'], forcedRng([50, 50]));
    expect(shiftsOf()).toEqual([[]]);
    spy.mockClear();
    give(foe, PK.easy_speaker);
    resolveSpeech(s, intent({ action: { type: 'persuade', target: 'patron_1' } }), ['patron_1'], forcedRng([50, 50]));
    expect(shiftsOf()).toEqual([[{ source: 'Easy Speaker', value: 1 }]]);
    spy.mockRestore();
  });
});
