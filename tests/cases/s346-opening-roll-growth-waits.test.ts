// 346 BG-272: every event roll opens a scenario, so what it earns (the event-roll critical chains) waits for that scenario's
// end, like all growth (D-226). Before, a roll made with no scenario running yet (the story's opening, or a start right
// after a story beat closed the last scenario) granted its achievement at once, outside any scenario's end.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { replayScenarioStart } from '../../src/scenario/director';
import { closeScenario, endScenario } from '../../src/engine/scenarioEnd';
import { ruleset } from '../../src/ruleset';
import { growthWaits } from '../../src/engine/xp';
import { ACH } from '../../src/library/achievementIds';
import type { GameState } from '../../src/types';

const earned = (s: GameState, key: string) => !!s.player.progression?.achievements?.some((a) => a.key === key);
const held = (s: GameState, key: string) => !!s.player.progression?.pendingAchievements?.some((a) => a.key === key);

describe('346 BG-272: an opening event roll grows nothing until its scenario ends', () => {
  it('the story opening: a natural 100 holds Critical Success\'s achievement until that scenario ends, with no flag', () => {
    const s = makeVillage();
    delete s.stage.scenario; delete s.stage.roam; // nothing has started yet
    expect(growthWaits(s)).toBe(false);
    const r = replayScenarioStart(s, [null], forcedRng([100, 100, 100, 100]));
    expect(r.eventRoll?.tier).toBe('critical_success');
    expect(earned(s, ACH.event_crit_1)).toBe(false);
    expect(held(s, ACH.event_crit_1)).toBe(true);
    endScenario(s, 'resolved', ''); s.stage.breakCause = 'scenario_end' as never; closeScenario(s);
    expect(earned(s, ACH.event_crit_1)).toBe(true);
    expect(s.log.some((l) => l.code === 'achievement_outside_end')).toBe(false);
  });

  it('a Critical Failure scar after a story beat closed the last scenario waits too', () => {
    const s = makeVillage();
    delete s.stage.scenario; delete s.stage.roam; // a 'new' ending closed the scenario without free roam
    ruleset.eventRoll(s.player, s, forcedRng([1]));
    expect(earned(s, ACH.event_crit_fail_1)).toBe(false);
    expect(held(s, ACH.event_crit_fail_1)).toBe(true);
    expect(s.log.some((l) => l.code === 'achievement_outside_end')).toBe(false);
    expect(growthWaits(s)).toBe(false); // the hold covers only the roll itself
  });
});
