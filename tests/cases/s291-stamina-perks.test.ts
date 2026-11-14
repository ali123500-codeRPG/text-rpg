// 291 SS1-SS14 Stamina perks. Catnap (20): a rest also clears an hour of sleep's debt. Iron Lungs (40): +10 Endurance.
// Forced March (60) is retired (SR5): the 60 slot is empty. Deep Lungs (80): line ×1.5. Sleepless (100): hours awake add debt ×0.2. Bottomless
// (120): strain ×0.5. Overdrive (140): above half a line, every roll adds 10% of Stamina for 1 strain. Second Breath (All-50 part): once a fight, an emptying line refills to half with no spill. Quirks
// Heavy Sleeper (a noise one level louder wakes them) and Insomniac (sleep ×0.75), rolled onto NPCs by template quirk tags.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { ruleset } from '../../src/ruleset';
import { tierMult } from '../../src/ruleset/gear';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { spawnNpc } from '../../src/library/spawn';
import { SKILL_PARTS } from '../../src/library/allPerks';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { TP } from '../../src/library/templateIds';
import { RV } from '../../src/library/tableIds';
import { now, advanceClock } from '../../src/time';
import { passiveFatigue, payMove, payStrain, restRecover, sleepMult } from '../../src/engine/fatigue';
import { fallAsleep, wakeByEvent } from '../../src/engine/sleep';
import { barMax, fatigueOf, lineMax, lineUsed, perkSleepMult } from '../../src/ruleset/fatigue';
import { trueSkill } from '../../src/ruleset/perks';

const quiet = () => makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1', 'guard_1', 'trader'] });
const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });
const pass = (s: GameState, minutes: number) => { advanceClock(s, minutes); passiveFatigue(s, minutes); };
const ev = (over: Partial<GameEvent>): GameEvent => ({ id: 'x', turn: 1, actorId: 'guard_1', kind: 'speak', zone: 'tav_cellar', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...over });

describe('291 stamina perks', () => {
  it('every built one is on the Stamina ladder at its milestone, and Second Breath is Stamina\'s All-50 part', () => {
    makeVillage();
    const perks = getLibrary().perks;
    for (const [id, m] of [[PK.catnap, 20], [PK.iron_lungs, 40], [PK.deep_lungs, 80], [PK.sleepless, 100], [PK.bottomless, 120], [PK.overdrive, 140]] as const) {
      expect(perks[id]?.ladder, id).toEqual({ skill: SK.stamina, milestone: m });
      expect(BUILT_PERKS.has(id), id).toBe(true);
    }
    expect(SKILL_PARTS[SK.stamina]).toBe(PK.second_breath);
    expect(perks[PK.short_sleeper]).toBeUndefined(); // banked (D-300)
    expect([perks[PK.heavy_sleeper].quirk, perks[PK.insomniac].quirk]).toEqual([true, true]);
  });

  it('SS1 Catnap: a rest clears as much sleep debt as an hour of sleep there, by the share of the hour', () => {
    const s = quiet();
    s.player.core.condition.fatigue = { debt: 20, line: 0, awake: 20 };
    restRecover(s, s.player, 1);
    expect(fatigueOf(s.player).debt).toBe(20);
    give(s.player, PK.catnap);
    const hour = (getLibrary().recovery![RV.sleep].debtPctPerHour! / 100) * barMax(s.player) * sleepMult(s, s.player);
    restRecover(s, s.player, 0.5);
    expect(fatigueOf(s.player).debt).toBeCloseTo(20 - hour / 2);
    expect(s.player.core.condition.fatigue!.awake).toBeCloseTo(20 - hour / 2);
    const rest = (catnap: boolean) => { // the Rest action runs through it (its hour awake adds debt too)
      const r = quiet();
      if (catnap) give(r.player, PK.catnap);
      r.player.core.condition.fatigue = { debt: 20, line: 0, hardAt: now(r) + 999 };
      play(r, { intent: intent({ action: { type: 'rest' } }) });
      return fatigueOf(r.player).debt;
    };
    expect(rest(false) - rest(true)).toBeCloseTo(hour);
  });

  it('SS2 Iron Lungs: +5 Stamina, +1 Stamina (its group), +10 Endurance', () => {
    const s = quiet();
    s.player.core.skills[SK.stamina] = { raw: 40, state: 'normal' };
    s.player.core.skills[SK.endurance] = { raw: 20, state: 'normal' };
    const [st, en] = [trueSkill(s.player, SK.stamina), trueSkill(s.player, SK.endurance)];
    give(s.player, PK.iron_lungs);
    expect(trueSkill(s.player, SK.stamina)).toBe(st + 6);
    expect(trueSkill(s.player, SK.endurance)).toBe(en + 10);
  });

  it('SS4 Deep Lungs: the short-term line is ×1.5', () => {
    const s = quiet();
    const before = lineMax(s.player);
    give(s.player, PK.deep_lungs);
    expect(lineMax(s.player)).toBeCloseTo(before * CONFIG.DEEP_LUNGS_LINE);
  });

  it('SS5/SS14 Sleepless: hours awake add debt ×0.2; spilled strain still fills the bar and counts toward marks', () => {
    const a = quiet(), b = quiet();
    give(b.player, PK.sleepless);
    expect(perkSleepMult(b.player, 'sleepNeed')).toBeCloseTo(CONFIG.SLEEPLESS_NEED);
    pass(a, 600); pass(b, 600);
    expect(fatigueOf(b.player).debt).toBeCloseTo(fatigueOf(a.player).debt * CONFIG.SLEEPLESS_NEED);
    const c = quiet();
    give(c.player, PK.sleepless);
    payStrain(c, c.player, 'hard', 30); // 60 strain on a 50-point line
    expect(fatigueOf(c.player).debt).toBeCloseTo(10 * CONFIG.SPILL_SHARE + 60 * CONFIG.STRAIN_RESIDUE);
    expect(c.player.core.condition.fatigue!.toMark).toBeCloseTo(60 % CONFIG.STAMINA_MARK_EVERY);
  });

  it('SS6 Bottomless: every strain cost is halved', () => {
    const s = quiet();
    give(s.player, PK.bottomless);
    payStrain(s, s.player, 'hard', 5);
    expect(lineUsed(s.player)).toBeCloseTo(CONFIG.STRAIN_COST.hard * 5 * CONFIG.BOTTOMLESS_STRAIN);
  });

  it('SS8 Second Breath: once per engagement, an emptying line refills to half and nothing spills; not outside a fight', () => {
    const s = quiet();
    give(s.player, PK.second_breath);
    payStrain(s, s.player, 'hard', 30); // no engagement: spills as usual
    expect(fatigueOf(s.player).debt).toBeGreaterThan(0);
    const f = quiet();
    give(f.player, PK.second_breath);
    f.player.engagement = { start: 1, last: 1, kinds: ['fight'] };
    f.player.core.condition.fatigue = { debt: 0, line: lineMax(f.player) - 2 };
    payStrain(f, f.player, 'hard', 3); // 6 strain, 2 left: line empties, refills to half, 4 more paid from it
    expect(fatigueOf(f.player).debt).toBeCloseTo(6 * CONFIG.STRAIN_RESIDUE); // no spill, only the residue (SR4)
    expect(lineUsed(f.player)).toBeCloseTo(lineMax(f.player) * (1 - CONFIG.SECOND_BREATH_PCT / 100) + 4);
    expect(f.log.some((l) => l.code === 'second_breath')).toBe(true);
    f.player.core.condition.fatigue!.line = lineMax(f.player); // once only: the next overflow spills
    payStrain(f, f.player, 'hard', 1);
    expect(fatigueOf(f.player).debt).toBeCloseTo(8 * CONFIG.STRAIN_RESIDUE + 2 * CONFIG.SPILL_SHARE);
  });

  it('SS10 Heavy Sleeper: a shout no longer wakes them, one level louder does; a blow still does', () => {
    const s = quiet();
    give(s.player, PK.heavy_sleeper);
    fallAsleep(s, s.player, now(s) + 480);
    wakeByEvent(s, ev({ kind: 'call_help', noise: CONFIG.WAKE_NOISE }));
    expect(s.player.asleep).toBeDefined();
    wakeByEvent(s, ev({ kind: 'call_help', noise: 'blaring' }));
    expect(s.player.asleep).toBeUndefined();
    fallAsleep(s, s.player, now(s) + 480);
    wakeByEvent(s, ev({ kind: 'attack', target: s.player.id }));
    expect(s.player.asleep).toBeUndefined();
  });

  it('SS11/SS14 Insomniac: sleep clears ×0.75, with the spot and armour', () => {
    const s = quiet();
    const base = sleepMult(s, s.player);
    give(s.player, PK.insomniac);
    expect(sleepMult(s, s.player)).toBeCloseTo(base * CONFIG.INSOMNIAC_CLEAR);
    give(s.player, PK.sleepless); // a sleepNeed perk leaves sleepClear alone
    expect(sleepMult(s, s.player)).toBeCloseTo(base * CONFIG.INSOMNIAC_CLEAR);
    // RN5 c: sleep multipliers multiply in full (Short Sleeper is banked: Heavy Sleeper carries its ×1.33 here)
    const hs = getLibrary().perks[PK.heavy_sleeper];
    hs.sleepClear = CONFIG.SHORT_SLEEPER_CLEAR;
    try {
      give(s.player, PK.heavy_sleeper);
      expect(perkSleepMult(s.player, 'sleepClear')).toBeCloseTo(CONFIG.INSOMNIAC_CLEAR * CONFIG.SHORT_SLEEPER_CLEAR);
    } finally { delete hs.sleepClear; }
  });

  it('SS12: a template\'s quirk tag rolls one quirk with that tag per NPC, the same for the same ID', () => {
    makeVillage();
    const t = getLibrary().templates[TP.patron];
    const was = t.quirkTags;
    t.quirkTags = ['sleep'];
    try {
      const quirks = (id: string) => spawnNpc(null, TP.patron, { id, zone: 'tav_common', placeId: 'tavern', bandId: 'patrons', name: id })
        .core.perks.map((p) => p.perkId).filter((p) => p === PK.heavy_sleeper || p === PK.insomniac);
      const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(quirks);
      for (const q of all) expect(q).toHaveLength(1);
      expect(new Set(all.flat()).size).toBe(2);
      expect(quirks('a')).toEqual(all[0]);
    } finally { t.quirkTags = was; }
  });
  it('SS15 Overdrive: with the line above half, every roll adds 10% of Stamina and costs 1 strain; at half or below, nothing', () => {
    const s = quiet();
    s.player.core.skills[SK.stamina] = { raw: 140, state: 'normal' };
    const go = () => ruleset.roll({ actorId: 'player', skill: SK.melee_light, modifiers: [], tierShifts: [] }, s, forcedRng([50]));
    expect(go().modifiers.some((m) => m.source === 'Overdrive')).toBe(false);
    expect(lineUsed(s.player)).toBe(0);
    give(s.player, PK.overdrive);
    const r = go();
    expect(r.modifiers.find((m) => m.source === 'Overdrive')?.value).toBeCloseTo(trueSkill(s.player, SK.stamina) * CONFIG.OVERDRIVE_SHARE * tierMult(SK.stamina));
    expect(lineUsed(s.player)).toBeCloseTo(CONFIG.OVERDRIVE_STRAIN);
    s.player.core.condition.fatigue!.line = lineMax(s.player) / 2; // half spent: off
    expect(go().modifiers.some((m) => m.source === 'Overdrive')).toBe(false);
    expect(lineUsed(s.player)).toBeCloseTo(lineMax(s.player) / 2);
  });
});
