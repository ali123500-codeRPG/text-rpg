// 205 Growth at the scenario's end (D-226, LF3): while a scenario runs, the player's achievements and All-XXX steps wait and are
// granted together when it ends, with one gains summary for the ending moment (skills, milestone unlocks, All-XXX,
// achievements, XP bar, levels). In free roam they wait for the next scenario's end (BG-217). One granted anywhere else is
// flagged (achievement_outside_end) and filed as a bug report.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { awardXp, charLevel, grantAchievement, xpToNext } from '../../src/engine/xp';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { noteGains, scenarioGainsNow } from '../../src/engine/growth';
import { play } from './w4-kit';
import { getLibrary } from '../../src/library';
import { isBugCode } from '../../src/save/bugs';

const frame = (s: GameState) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r));
const end = (s: GameState) => { endScenario(s, 'resolved', ''); s.stage.breakCause = 'scenario_end' as never; return closeScenario(s); };
const has = (s: GameState, key: string) => (s.player.progression!.achievements ?? []).some((a) => a.key === key);
const firstSlime = (s: GameState) => grantAchievement(s, ACH.first_defeat_body_type, 'slime');

describe('205 growth lands at the scenario end', () => {
  it('with no scenario and no free roam (nothing has started one) an achievement is granted at once', () => {
    const s = makeVillage();
    firstSlime(s);
    expect(has(s, ACH.first_defeat_body_type)).toBe(true);
    // granted outside a scenario's end: flagged, and the game files it as a bug report
    expect(s.log.find((l) => l.code === 'achievement_outside_end')?.detail).toMatchObject({ why: 'no_scenario' });
    expect(isBugCode('achievement_outside_end')).toBe(true);
  });

  it('while a scenario runs it waits, then the end grants it with its XP and leaves the gains summary', () => {
    const s = makeVillage();
    frame(s);
    const xp0 = s.player.progression!.xp;
    firstSlime(s);
    firstSlime(s); // queued once
    expect(has(s, ACH.first_defeat_body_type)).toBe(false);
    expect(s.player.progression!.pendingAchievements).toHaveLength(1);
    expect(s.player.progression!.xp).toBe(xp0);
    s.turn += 3;
    s.log.push({ turn: s.turn, code: 'skill_improved', detail: { skill: SK.dodge, from: 25, to: 27 } });
    noteGains(s);
    s.turn += 1;
    s.log.push({ turn: s.turn, code: 'skill_improved', detail: { skill: SK.dodge, from: 27, to: 30, milestone: 20 } });
    end(s); // the ending turn's own raises count even when nothing noted them yet
    expect(has(s, ACH.first_defeat_body_type)).toBe(true);
    expect(s.player.progression!.pendingAchievements).toBeUndefined();
    expect(s.log.some((l) => l.code === 'achievement_outside_end')).toBe(false); // granted at the end: no flag
    const g = scenarioGainsNow(s)!;
    expect(g.achievements.map((a) => a.id)).toEqual([`${getLibrary().achievements![ACH.first_defeat_body_type].id}:slime`]);
    expect(g.skills).toEqual([{ skill: SK.dodge, from: 25, to: 30 }]);
    expect(g.perks).toEqual([{ skill: SK.dodge, milestone: 20 }]);
    expect(g.xp.gained).toBeGreaterThan(0);
    expect(g.xp).toMatchObject({ fromLevel: 1, fromPct: 0 });
    expect(g.xp.toLevel * 100 + g.xp.toPct).toBeGreaterThan(g.xp.fromLevel * 100 + g.xp.fromPct);
    s.turn += 1;
    expect(scenarioGainsNow(s)).toBeUndefined(); // only on the turn that ended it
  });

  it('BG-217: growth earned in free roam waits for the next scenario\'s end, and its gains moment counts the roam\'s XP', () => {
    const s = makeVillage();
    frame(s);
    expect(end(s)).toBe('roam');
    const lvl = charLevel(s.player), from = s.player.progression!.xpLog?.length ?? 0;
    s.turn += 1;
    firstSlime(s);
    awardXp(s, xpToNext(s.player) + 5, 'quest:q1'); // enough for a level
    expect(has(s, ACH.first_defeat_body_type)).toBe(false);
    expect(s.player.progression!.pendingAchievements).toHaveLength(1);
    expect(charLevel(s.player)).toBe(lvl); // the level waits too
    s.turn += 1;
    delete s.stage.roam; // a scenario starts (beginScenario ends free roam)
    frame(s);
    expect(s.stage.roamGrowth).toBeUndefined();
    s.turn += 1;
    end(s);
    expect(has(s, ACH.first_defeat_body_type)).toBe(true);
    expect(charLevel(s.player)).toBeGreaterThan(lvl);
    const g = scenarioGainsNow(s)!;
    expect(g.achievements).toHaveLength(1);
    expect(g.xp.gained).toBe(s.player.progression!.xpLog!.slice(from).reduce((n, x) => n + x.amount, 0)); // the roam's quest XP and the achievement's
    expect(g.xp.parts?.some((p) => p.kind === 'quest')).toBe(true);
    expect(g.levelUps.length).toBeGreaterThan(0);
  });

  it('the player\'s All-XXX waits for the end too; mastery achievements come with it', () => {
    const s = makeVillage();
    frame(s);
    const tree = getLibrary().trees[TR.melee];
    for (const k of tree.skills.slice(0, 3)) s.player.core.skills[k] = { raw: 50, state: 'normal' };
    play(s); // a turn: resolve skips the player's All-XXX while the scenario runs
    expect(s.player.core.perks.some((p) => p.source === 'mastery')).toBe(false);
    expect(has(s, ACH.mastery_50)).toBe(false);
    end(s);
    expect(s.player.core.perks.some((p) => p.source === 'mastery' && p.treeId === TR.melee)).toBe(true);
    expect(has(s, ACH.mastery_50)).toBe(true);
    const g = scenarioGainsNow(s)!;
    expect(g.allPerks.some((x) => x.tree === TR.melee && x.step === 50)).toBe(true);
    expect(g.achievements.some((a) => a.id.startsWith(getLibrary().achievements![ACH.mastery_50].id))).toBe(true);
  });
});
