// 278 FT1–FT28 fatigue and the Stamina skill. A stamina bar in two layers sized 50 + Stamina: the long term (sleep debt and
// spilled strain, cleared only by sleep) sets the fatigue level, its roll penalty and the short line's band; the short line
// drains first by the effort tier every action names (no roll), spills at half, and comes back by catching your breath,
// resting and sleeping. Sleep lasts until rested. Debt that fills the bar puts you to sleep; spill that fills it leaves you
// Spent. Stamina is the third Fortitude skill, its own group at quarter XP, marked per 50 strain of any effort (FB6).
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { sleepDebtFor } from '../harness/sleep';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { DU, FU } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { FN, GR } from '../../src/library/functionIds';
import { FUNCTION_GROUP } from '../../src/library/functionNames';
import { TR } from '../../src/library/treeIds';
import { TP } from '../../src/library/templateIds';
import { EFFORT } from '../../src/scales';
import { now } from '../../src/time';
import { actorById } from '../../src/engine/relations';
import { passiveFatigue, payStrain, sleepMinutes } from '../../src/engine/fatigue';
import { barMax, debtPct, fatigueLevel, fatigueOf, isSpent, lineMax, lineUsed } from '../../src/ruleset/fatigue';
import { woundsMods } from '../../src/ruleset/body';
import { rollUniqueSkills } from '../../src/library/spawn';
import { createRng } from '../../src/rng';
import { buildActorView, buildPlayerView } from '../../src/views';
import { advanceClock } from '../../src/time';

const quiet = () => makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1', 'guard_1', 'trader'] });
/** the patron is hostile to the player and knows where they are: a fight */
const fight = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const pass = (s: GameState, minutes: number) => { advanceClock(s, minutes); passiveFatigue(s, minutes); };
const withStamina = (s: GameState, v: number) => { s.player.core.skills[SK.stamina] = { raw: v, state: 'normal' }; return s; };

describe('278 fatigue and stamina', () => {
  it('FT24/FT25: one tier table, Base free; every Action times row names a tier', () => {
    makeVillage();
    expect(EFFORT.keys.map((k) => CONFIG.STRAIN_COST[k])).toEqual([0, 0.5, 1, 2, 4]);
    for (const r of Object.values(getLibrary().durations ?? {})) expect(EFFORT.has(r.effort), r.id).toBe(true);
    const d = getLibrary().durations!;
    expect([d[DU.talk].effort, d[DU.door].effort, d[DU.blow].effort, d[DU.battle_cry].effort]).toEqual(['base', 'base', 'hard', 'all_out']);
  });

  it('FT2/FT23: strain drains the line first, then spills half into the long term; armour multiplies it', () => {
    const s = quiet();
    expect(barMax(s.player)).toBe(CONFIG.STAMINA_BASE);
    payStrain(s, s.player, 'hard', 30); // 60 strain on a 50-point line
    expect(lineUsed(s.player)).toBe(lineMax(s.player));
    expect(fatigueOf(s.player).debt).toBeCloseTo(10 * CONFIG.SPILL_SHARE);
    const m = quiet();
    m.player.core.inventory = m.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
    payStrain(m, m.player, 'moderate', 4);
    expect(lineUsed(m.player)).toBe(4);
  });

  it('FT25 check: a blow and a defence every 3 s (2.5 a round) empties the line in 1 min at Stamina 0, 2 at 50, 3 at 100', () => {
    for (const [st, minutes] of [[0, 1], [50, 2], [100, 3]]) {
      const s = withStamina(quiet(), st);
      let rounds = 0;
      while (lineUsed(s.player) < lineMax(s.player) - 1e-9) { payStrain(s, s.player, 'hard'); payStrain(s, s.player, 'light'); rounds++; }
      expect(rounds * 3 / 60).toBeCloseTo(minutes);
    }
  });

  it('FT4/FT3: hours awake add debt: Tired after 12 h at Stamina 0 and 15 h at 50, with its roll penalty and a smaller line', () => {
    const s = quiet();
    pass(s, 12 * 60 - 1);
    expect(fatigueLevel(s.player)).toBe('fine');
    pass(s, 1);
    expect(fatigueLevel(s.player)).toBe('tired');
    expect(woundsMods(s, s.player, SK.melee_medium)).toContainEqual({ source: 'fatigue: Tired', type: 'wounds', value: -5 });
    expect(lineMax(s.player)).toBeCloseTo(0.8 * barMax(s.player));
    const f = withStamina(quiet(), 50);
    pass(f, 15 * 60 - 1);
    expect(fatigueLevel(f.player)).toBe('fine');
    pass(f, 1);
    expect(fatigueLevel(f.player)).toBe('tired');
  });

  it('FT12: a body type that never needs sleep gains no debt', () => {
    const s = quiet();
    getLibrary().bodyTypes[s.player.core.bodyTypeId].sleepNeed = 0;
    try { pass(s, 30 * 60); expect(fatigueOf(s.player).debt).toBe(0); } finally { delete getLibrary().bodyTypes[s.player.core.bodyTypeId].sleepNeed; }
  });

  it('FT28: the line comes back 15 % + Stamina × 0.05 % a minute, only after 10 calm seconds', () => {
    const s = quiet();
    payStrain(s, s.player, 'hard', 10); // 20 used, now
    pass(s, CONFIG.BREATH_CALM_S / 60);
    expect(lineUsed(s.player)).toBeCloseTo(20); // still winded
    pass(s, 1);
    expect(lineUsed(s.player)).toBeCloseTo(20 - 0.15 * lineMax(s.player), 1);
  });

  it('FT7/FT8/FT9: sleep clears 4 % an hour (× 0.75 off a bed, × armour) and lasts until rested, 1 to 24 hours', () => {
    const s = quiet();
    expect(sleepMinutes(s, s.player)).toBe(60); // nothing to clear: the shortest sleep
    sleepDebtFor(s, 5);
    expect(sleepMinutes(s, s.player)).toBe(300);
    s.player.core.condition.fatigue!.debt = barMax(s.player);
    expect(sleepMinutes(s, s.player)).toBeLessThanOrEqual(CONFIG.SLEEP_MAX_HOURS * 60);
    const bed = quiet();
    bed.zones.find((z) => z.id === bed.player.zone)!.furniture = [{ id: 'b1', kind: FU.bed, name: 'bed' }];
    bed.player.core.condition.fatigue = { debt: 10, line: 30 };
    bed.player.asleep = { since: now(bed) };
    pass(bed, 60);
    expect(fatigueOf(bed.player).debt).toBeCloseTo(10 - 0.04 * barMax(bed.player));
    expect(lineUsed(bed.player)).toBe(0);
  });

  it('FT9: "sleep" runs until rested and clears the debt; a rest fills the line', () => {
    const s = quiet();
    sleepDebtFor(s, 3);
    const t0 = now(s);
    play(s, { intent: intent({ action: { type: 'sleep' } }) });
    expect(now(s) - t0).toBe(3 * 60 + 1);
    expect(fatigueOf(s.player).debt).toBeLessThan(0.1); // only the turn's own awake minute since
    const r = quiet();
    r.player.core.condition.fatigue = { debt: 0, line: 40 };
    r.player.core.condition.fatigue.hardAt = now(r) + 999; // keep breath out of it
    play(r, { intent: intent({ action: { type: 'rest' } }) });
    expect(lineUsed(r.player)).toBe(0);
  });

  it('FT10: debt that fills the bar puts you to sleep; spill that fills it leaves you Spent, nothing above Light', () => {
    const s = quiet();
    s.player.core.condition.fatigue = { debt: barMax(s.player) - 0.1, line: 0 };
    pass(s, 10);
    expect(s.player.asleep).toBeDefined();
    expect(s.night).toBeDefined();
    // FB4 b: Spent and awake, you still fall asleep once the hours awake alone would have filled the bar
    const w = quiet();
    w.player.core.condition.fatigue = { debt: barMax(w.player), line: 0, awake: barMax(w.player) - 0.1 };
    expect(isSpent(w.player)).toBe(true);
    pass(w, 10);
    expect(w.player.asleep).toBeDefined();
    const z = quiet();
    z.player.core.condition.fatigue = { debt: barMax(z.player), line: 0, awake: 0 };
    pass(z, 60);
    expect(z.player.asleep).toBeUndefined();
    const f = fight();
    f.player.core.condition.fatigue = { debt: barMax(f.player) - 1, line: lineMax(f.player) };
    payStrain(f, f.player, 'hard');
    expect(isSpent(f.player)).toBe(true);
    expect(f.log.some((l) => l.code === 'spent')).toBe(true);
    const evs = play(f, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) });
    expect(evs.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('spent');
    expect(buildPlayerView(f).player.stamina.spent).toBe(true);
  });

  it('FT15/FT27: Stamina is the third Fortitude skill, own group at quarter XP; marked per 50 strain of any effort', () => {
    const s = quiet();
    const lib = getLibrary();
    expect(lib.trees[TR.fortitude].skills).toEqual([SK.endurance, SK.resolve, SK.stamina]);
    expect(lib.skills[SK.stamina].functions).toEqual([FN.stamina]);
    expect(FUNCTION_GROUP[FN.stamina]).toBe(GR.stamina);
    expect(CONFIG.XP_GROUP_FACTOR[GR.stamina]).toBe('quarter');
    s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
    payStrain(s, s.player, 'light', 48);
    payStrain(s, s.player, 'hard', 12);
    expect(s.player.progression!.marks).not.toContain(SK.stamina);
    payStrain(s, s.player, 'light', 4);
    expect(s.player.progression!.marks).toContain(SK.stamina);
    const guard = rollUniqueSkills({ ...lib.templates[TP.guard], minimums: { ...lib.templates[TP.guard].minimums, [SK.endurance]: 40 } }, createRng(1));
    expect(guard[SK.stamina].raw).toBe(guard[SK.endurance].raw);
  });

  it('FT17/FT20: your own bar in points; others\' fatigue only from Exhausted down', () => {
    const s = fight();
    s.player.core.condition.fatigue = { debt: 10, line: 5 };
    expect(buildPlayerView(s).player.stamina).toEqual({ level: 'Fine', left: 40, max: 50, lineLeft: 40, lineMax: 45 });
    const p = actorById(s, 'patron_1')!;
    const seen = () => buildPlayerView(s).actors.find((a) => a.id === p.id)!;
    p.core.condition.fatigue = { debt: 0.55 * barMax(p), line: 0 };
    expect(seen().fatigue).toBeUndefined();
    p.core.condition.fatigue.debt = 0.6 * barMax(p);
    expect(seen().fatigue).toBe('Exhausted');
    expect(buildActorView(s, p.id).self.fatigue).toBe('Exhausted');
    expect(debtPct(p)).toBeCloseTo(60);
  });

  it('whole turn: an attack in a fight drains the line, and the Narrator gets the fatigue level', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
    const s = g.game.state()!;
    const m = actorById(s, 'patron_1')!.mind!;
    m.overrides = { player: 'hostile' };
    m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    await g.turn(intent({ action: { type: 'attack', target: 'patron_1' } }));
    expect(lineUsed(g.game.state()!.player)).toBeGreaterThan(0);
    const req = g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] };
    expect(req.input[1].content).toMatch(/"fatigue":"Rested"/);
  });
});
