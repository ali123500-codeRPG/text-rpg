// 67 Routine-only degrade: a plan with an unbound route slot fails, gets one repair retry, fails again: only that
// actor gets idle_here, the rest applies, all four flags appear (stage record, routine_fallback log; the GM banner
// and play-screen marker are drawn from stage.fallback by the UI).
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng, actor } from '../harness';
import { ruleset } from '../../src/ruleset';
import { SceneDirector } from '../../src/scene';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scene/fixtures';

describe('67 Routine-only degrade', () => {
  it('degrades one actor and applies the rest', async () => {
    const roll = vi.spyOn(ruleset, 'eventRoll').mockReturnValue({ actorId: 'player', roll: 60, tier: 'success', modifiers: [] });
    const p = villageStagePlan('success');
    p.cast[3].slots = { post: 'field_far' }; // slime_1: route unbound
    const weave = vi.fn(async () => p);
    const s = toStoryStart(makeVillage());
    const r = await new SceneDirector({ weave, clock: new VirtualClock() }).storyStart(s, createRng(s.rngState));
    expect(weave).toHaveBeenCalledTimes(2);
    expect(weave.mock.calls[1]).toEqual([expect.anything(), [expect.objectContaining({ code: 'missing_slot', castKey: 'slime_1', routineOnly: true })], p]); // V11: the rejected plan comes back
    expect(r.outcome).toBe('degraded');
    const slime = actor(s, 'slime_1');
    expect(slime.mind!.routine!.id).toBe('idle_here');
    expect(slime.mind!.slots).toEqual({ here: 'field_far' });
    expect(slime.zone).toBe('field_far');
    expect(actor(s, 'slime_2').mind!.routine!.id).toBe('roam_field');
    expect(actor(s, 'guard_1').mind!.routine!.id).toBe('guard_post');
    expect(s.stage.fallback).toEqual({ reason: 'routine_fallback', turn: 0 });
    expect(s.stage.routineFallback).toEqual({ actors: ['slime_1'], turn: 0 });
    expect(s.log.find((l) => l.code === 'routine_fallback')!.detail!.errors).toEqual([expect.objectContaining({ code: 'missing_slot' })]);
    roll.mockRestore();
  });
});
