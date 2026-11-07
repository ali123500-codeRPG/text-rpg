// 33 Grades must fit the tier: a Failure-tier plan with gain major fails validation, gets one repair retry
// with the errors, and the corrected plan applies.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { ruleset } from '../../src/ruleset';
import { SceneDirector, type PlanError } from '../../src/scene';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scene/fixtures';

describe('33 Grades must fit the tier', () => {
  it('repairs a misfit plan once, then applies it', async () => {
    const roll = vi.spyOn(ruleset, 'situation').mockReturnValue({ actorId: 'player', roll: 30, tier: 'failure', modifiers: [] });
    const bad: StagePlan = { ...villageStagePlan('failure'), event: { summary: 'slimes raid the field', challenge: 'moderate', gain: 'major' } };
    const good = villageStagePlan('failure');
    const weave = vi.fn(async (_v: unknown, errors?: PlanError[]) => (errors ? good : bad));
    const s = toStoryStart(makeVillage());
    const r = await new SceneDirector({ weave, clock: new VirtualClock() }).storyStart(s, createRng(s.rngState));
    expect(weave).toHaveBeenCalledTimes(2);
    expect(weave.mock.calls[1][1]).toEqual([expect.objectContaining({ code: 'grades_misfit', routineOnly: false })]);
    expect(r.outcome).toBe('applied');
    expect(s.hidden.stage).toMatchObject({ challenge: 'moderate', gain: 'minor' });
    expect(s.stage.fallback).toBeUndefined();
    roll.mockRestore();
  });
});
