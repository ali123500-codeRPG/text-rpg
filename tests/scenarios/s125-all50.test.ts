// 125 All-50 parts (All-50 doc round 1): once three skills of a tree reach 50 true skill, the tree's passive and those
// skills' parts are granted free, with the tree's mastery achievement; a further skill at 50 adds its part. Then the built parts.
import { AM } from '../../src/library/tableIds';
import { TR } from '../../src/library/treeIds';
import { ACH } from '../../src/library/achievementIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fit, forcedRng, makeVillage, place } from '../harness';
import { ruleset, trueSkill } from '../../src/ruleset';
import { grantAllSteps, shareSpotted } from '../../src/ruleset/allSteps';
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

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const set = (a: Actor, skills: string[], raw: number) => { for (const k of skills) a.core.skills[k] = { raw, state: 'normal' }; };
const arm = (s: GameState, id: string, itemId: string = IT.dagger) => {
  const a = id === 'player' ? s.player : s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
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
    expect(got).toEqual([PK.fighters_frame, PK.opening_strike, PK.steady_guard, PK.counter]);
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
    set(p, [SK.insight], 50); // Insight has no part yet: the passive and the other two parts come
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.curiouser, PK.night_eyes, PK.spotter]);
    const q = makeVillage().player;
    q.core.perks = [];
    set(q, [SK.melee_light, SK.melee_heavy, SK.melee_medium], 0);
    set(q, [SK.melee_light, SK.melee_heavy], 50);
    set(q, [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], 50);
    const s2 = makeVillage(); s2.player = q;
    grantAllSteps(s2, q);
    expect(q.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.hunters_eye, PK.unerring, PK.volley, PK.past_the_cover]);
    set(q, [SK.dodge, SK.block], 60); // Defense has two skills now
    grantAllSteps(s2, q);
    expect(q.core.perks.some((x) => x.perkId === PK.dodgy || x.perkId === PK.thick_hide)).toBe(false);
    set(q, [SK.melee_medium], 50); // the third Arms skill: passive + all three parts
    grantAllSteps(s2, q);
    expect(q.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId).slice(4)).toEqual([PK.fighters_frame, PK.opening_strike, PK.steady_guard, PK.counter]);
  });
  it('a tree\'s rating sets how many skills at 50 earn it: inferior never, superior 2, legendary 1', () => {
    const s = makeVillage(), p = s.player;
    p.core.perks = [];
    const lib = getLibrary();
    expect(lib.trees[TR.slime_senses].rating).toBe('inferior');
    expect(Object.values(lib.trees).filter((t) => t.id !== TR.slime_senses).every((t) => (t.rating ?? 'normal') === 'normal')).toBe(true);
    set(p, [SK.eyesight, SK.earshot], 50);
    lib.trees[TR.perception].rating = 'superior';
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.curiouser, PK.night_eyes, PK.spotter]);
    set(p, [SK.melee_medium, SK.melee_heavy], 0);
    set(p, [SK.melee_light], 50);
    lib.trees[TR.melee].rating = 'legendary';
    grantAllSteps(s, p);
    expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId).slice(3)).toEqual([PK.fighters_frame, PK.opening_strike]);
    set(p, [SK.ranged_light, SK.ranged_medium, SK.ranged_heavy], 50);
    lib.trees[TR.ranged].rating = 'inferior';
    grantAllSteps(s, p);
    expect(p.core.perks.some((x) => x.perkId === PK.hunters_eye)).toBe(false);
    expect(p.progression?.achievements?.some((a) => a.id === `${ACH.mastery_50}:${TR.ranged}`) ?? false).toBe(false);
  });
  it("a skill that moves to another tree takes its part along", () => {
    const s = makeVillage(), p = s.player;
    const lib = getLibrary(), arms = lib.trees[TR.melee], def = lib.trees[TR.defense];
    const [armsSkills, defSkills] = [arms.skills, def.skills];
    try {
      arms.skills = [...armsSkills, SK.dodge];
      def.skills = defSkills.filter((x) => x !== SK.dodge);
      p.core.perks = [];
      set(p, [SK.melee_light, SK.melee_medium, SK.melee_heavy], 0);
      set(p, [SK.melee_light, SK.dodge, SK.melee_medium], 50);
      grantAllSteps(s, p);
      expect(p.core.perks.filter((x) => x.source === 'mastery').map((x) => x.perkId)).toEqual([PK.fighters_frame, PK.opening_strike, PK.steady_guard, PK.dodgy]);
    } finally {
      arms.skills = armsSkills;
      def.skills = defSkills;
    }
  });
  it("Hunter's Eye: +10 true skill in every skill with the sight function", () => {
    const s = makeVillage();
    set(s.player, [SK.eyesight, SK.earshot], 30);
    give(s.player, PK.hunters_eye);
    expect(trueSkill(s.player, SK.eyesight)).toBe(40);
    expect(trueSkill(s.player, SK.earshot)).toBe(30);
  });
  it('Silver Words: +5 true skill in Persuasion, Intimidation and Barter', () => {
    const s = makeVillage();
    set(s.player, [SK.persuasion, SK.intimidation, SK.barter, SK.eyesight], 30);
    give(s.player, PK.silver_words);
    expect([SK.persuasion, SK.intimidation, SK.barter, SK.eyesight].map((k) => trueSkill(s.player, k))).toEqual([35, 35, 35, 30]);
  });
  it("Fighter's Frame: melee hits on the owner deal ×0.9 damage before armor", () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, PK.fighters_frame);
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
      arm(s, 'player', IT.shortbow);
      if (perk) give(s.player, PK.past_the_cover);
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
    const before = [mod(SK.sneaking), mod(SK.eyesight)];
    give(s.player, PK.child_of_night);
    expect(before).toEqual([5, -5]);
    expect([mod(SK.sneaking), mod(SK.eyesight)]).toEqual([10, -5]); // dim read as dark for sneaking; sight unchanged
  });
  it('Curiouser and Curiouser: a sight or hearing roll at Success or better counts one tier higher', () => {
    const s = makeVillage();
    set(s.player, [SK.eyesight, SK.persuasion], 50);
    give(s.player, PK.curiouser);
    const r = (skill: string, d: number) => ruleset.roll({ actorId: 'player', skill, modifiers: [], tierShifts: [] }, s, forcedRng([d]));
    expect(r(SK.eyesight, 90).tierShifts).toEqual([{ source: 'Curiouser and Curiouser', value: 1 }]);
    expect(r(SK.eyesight, 10).tierShifts).toEqual([]); // not a Success
    expect(r(SK.persuasion, 90).tierShifts).toEqual([]); // not a sense roll
  });
  it('Iron Knuckles: unarmed hits deal ×1.1 damage before armor', () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
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
    place(s, 'patron_1', s.player.zone);
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
    place(s, 'patron_1', s.player.zone);
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
    give(o, PK.spotter);
    shareSpotted(s, o);
    expect(mate.mind!.knowledge.player.status).toBe('suspicious');
    expect(mate.mind!.knowledge.player.source).toBe('told');
  });
  it('Steady Guard: +5 true Block always, +5 effective on Block rolls made with a melee weapon', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    arm(s, 'player');
    set(s.player, [SK.block], 30);
    give(s.player, PK.steady_guard);
    expect(trueSkill(s.player, SK.block)).toBe(35);
    s.player.core.standingDefense = 'block';
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([90, 50, 50, 50]));
    expect(r.defense!.modifiers.filter((m) => m.source === 'Steady Guard')).toEqual([{ source: 'Steady Guard', type: 'roll_perk', value: 2.5 }]);
  });
  it('Thick Hide: health lost from a hit is ×0.95, after armor', () => {
    const dmg = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      if (perk) give(s.player, PK.thick_hide);
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
    const before = [mod(SK.eyesight), mod(SK.sneaking)];
    give(s.player, PK.night_eyes);
    expect([mod(SK.eyesight), mod(SK.sneaking)]).toEqual([situational(s, SK.eyesight, { light: { ...zone, light: 'dim' } }).modifiers[0]?.value ?? 0, before[1]]);
    expect(mod(SK.eyesight)).toBeGreaterThan(before[0]);
  });
  it('Dodgy: attack rolls against the owner get −5 effective skill', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'patron_1');
    give(s.player, PK.dodgy);
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
    give(s.actors.find((a) => a.id === 'patron_1')!, PK.counter);
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
    give(u.actors.find((a) => a.id === 'patron_1')!, PK.counter);
    const plain = fight(u, 'patron_1', 'w_player', (r) => ({ ...r, attack: { ...r.attack, tier: 'failure' as const }, outcome: 'missed' as const, damage: 0, location: null }));
    expect(plain[1]).not.toEqual({ by: 'patron_1', at: 'player' }); // a plain Failure gives nothing at once
  });
  it('Second Wind: once per engagement, at Wounded or worse the health track moves one level better', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    const foe = s.actors.find((a) => a.id === 'patron_1')!;
    give(foe, PK.second_wind);
    foe.core.condition.hpLostPct = 50; // Wounded
    const graze = (r: AttackResult) => ({ ...r, outcome: 'grazed' as const, location: 'general', damage: 0.01 });
    fight(s, 'patron_1', 'w_player', graze);
    expect(foe.core.condition.hpLostPct).toBeLessThanOrEqual(45); // Injured at most
    expect(foe.engagement?.uses?.[PK.second_wind]).toBe(1);
  });
  it('Strike and Fade: right after an attack from hiding the owner is stealthy again and vanishes in place', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    arm(s, 'player');
    give(s.player, PK.strike_and_fade);
    s.player.posture = 'stealthy';
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
    const fade = ev.find((e) => e.actorId === 'player' && e.kind === 'hide' && e.vanish);
    expect(fade?.effects.map((f) => f.kind)).toContain(PK.strike_and_fade);
    expect(s.log.some((l) => l.code === 'stealth_contest' && (l.detail as { skill: string }).skill === SK.vanishing)).toBe(true);
  });
  it('Volley: once per engagement, a ranged hit is followed by a free shot at a foe already hostile and known', () => {
    const run = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'player', 'field_mid');
      place(s, 'slime_2', 'field_mid');
      arm(s, 'player', IT.shortbow);
      if (perk) give(s.player, PK.volley);
      const hit = (r: AttackResult) => ({ ...r, outcome: 'full_hit' as const, location: 'general', damage: 0.01 });
      return { s, calls: fight(s, 'slime_1', 'w_player', hit).filter((c) => c.by === 'player') };
    };
    expect(run(false).calls.length).toBe(1);
    const { s, calls } = run(true);
    expect(calls.length).toBe(2);
    expect(['slime_1', 'slime_2']).toContain(calls[1].at);
    expect(s.player.engagement?.uses?.[PK.volley]).toBe(1);
  });
  it('Opening Strike: the first melee attack on each foe in an engagement gets tier shift +1', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
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
  it('Unerring: the first ranged attack in an engagement, at a foe that hasn\'t acted, gives its defense roll tier shift −1', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    arm(s, 'player', IT.shortbow);
    give(s.player, PK.unerring);
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
    set(s.player, [SK.sneaking], 40);
    const r = (d: number, up?: string) => ruleset.roll({ actorId: 'player', skill: SK.sneaking, modifiers: [], tierShifts: [], ...(up ? { nearMissUp: up } : {}) }, s, forcedRng([d]));
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
    give(foe, PK.easy_speaker);
    resolveSpeech(s, intent({ action: { type: 'persuade', target: 'patron_1' } }), ['patron_1'], forcedRng([50, 50]));
    expect(shiftsOf()).toEqual([[{ source: 'Easy Speaker', value: 1 }]]);
    spy.mockRestore();
  });
});
