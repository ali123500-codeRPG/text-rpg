// 205 Growth at the scenario's end (D-226, LF3): while a scenario runs, the player's achievements and All-XXX steps wait and are
// granted together when it ends, with one gains summary for the ending moment (skills, milestone unlocks, All-XXX,
// achievements, XP bar, levels). In free roam they come at once.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { grantAchievement } from '../../src/engine/xp';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { noteGains, scenarioGainsNow } from '../../src/engine/growth';
import { play } from './w4-kit';
import { getLibrary } from '../../src/library';

const frame = (s: GameState) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r));
const end = (s: GameState) => { endScenario(s, 'resolved', ''); s.stage.breakCause = 'scenario_end' as never; return closeScenario(s); };
const has = (s: GameState, key: string) => (s.player.progression!.achievements ?? []).some((a) => a.key === key);
const firstSlime = (s: GameState) => grantAchievement(s, ACH.first_defeat_body_type, 'slime');

describe('205 growth lands at the scenario end', () => {
  it('in free roam an achievement is granted at once', () => {
    const s = makeVillage();
    firstSlime(s);
    expect(has(s, ACH.first_defeat_body_type)).toBe(true);
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
