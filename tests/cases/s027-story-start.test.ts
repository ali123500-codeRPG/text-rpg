// 27 Story start: turn 0 makes one event roll, one Weaver call (and one Narrator call), and is saved as turn 0.
// W6 part: the director runs setup alone as turn 0. The Narrator call and the save belong to the pipeline (W7).
import { TIERS } from '../../src/scales';
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { ScenarioDirector } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';

describe('27 Story start', () => {
  it('turn 0: one event roll, one Weaver call, the village stage, opening events', async () => {
    const roll = vi.spyOn(ruleset, 'eventRoll');
    const weave = vi.fn(async (view: { tier: string }) => villageStagePlan(TIERS.keyOf(view.tier)!));
    const s = toStoryStart(makeVillage());
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    const r = await d.storyStart(s, createRng(s.rngState));
    expect(roll).toHaveBeenCalledTimes(1);
    expect(weave).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe('applied');
    expect(s.turn).toBe(0);
    expect(s.stage.scenarioStartTurn).toBe(0);
    expect(s.player.zone).toBe('tav_common');
    expect(r.eventRoll).toBe(d.lastEventRoll);
    expect(r.events[0].kind).toBe('arrival');
    expect(s.events).toEqual(r.events);
    roll.mockRestore();
  });
});
