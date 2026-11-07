// 34 Fallback is flagged: a plan that fails twice yields the fallback stage, and all four flags appear:
// stage record, weaver_fallback log, GM banner, play-screen marker. The banner and the marker are drawn by
// the UI from stage.fallback (GmSnapshot.fallbackBanner / Notice scene_fallback, W7/W8); this test checks their source.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { ruleset } from '../../src/ruleset';
import { SceneDirector } from '../../src/scene';
import { villageStagePlan, VirtualClock } from '../../src/scene/fixtures';

describe('34 Fallback is flagged', () => {
  it('two failed plans give the flagged fallback stage until the next scene start', async () => {
    const roll = vi.spyOn(ruleset, 'situation').mockReturnValue({ actorId: 'player', roll: 60, tier: 0, modifiers: [] });
    const s = makeVillage();
    s.turn = 5;
    const bad: StagePlan = { ...villageStagePlan(0), event: { summary: 'x', challenge: 'none', gain: 'extreme' } };
    const weave = vi.fn(async () => bad);
    const d = new SceneDirector({ weave, clock: new VirtualClock() });
    const nActors = s.actors.length;
    const r = await d.startScene(s, createRng(s.rngState));
    expect(weave).toHaveBeenCalledTimes(2);
    expect(r.outcome).toBe('fallback');
    expect(s.stage.fallback).toEqual({ reason: 'invalid_plan', turn: 5 });
    const entry = s.log.find((l) => l.code === 'weaver_fallback')!;
    expect(entry.detail!.errors).toEqual([expect.objectContaining({ code: 'grades_misfit' })]);
    expect(s.hidden.stage).toMatchObject({ challenge: 'none', gain: 'none' });
    expect(s.actors).toHaveLength(nActors); // no new cast
    expect(s.stage.zoneIds).toContain('tav_common'); // the place's saved zones

    // the flags stay until the next scene start
    weave.mockResolvedValue(null as never);
    weave.mockResolvedValueOnce({ ...villageStagePlan(0), places: [], bands: [], cast: [], rewards: [], frontiers: [], hiddenTerms: [],
      zones: [{ key: 'snug', place: 'tavern', name: 'the snug', look: 'a cramped side room', cover: 1, light: 1, links: [{ to: 'tav_common', label: 'the common room', sight: true }] }] });
    s.turn = 9;
    await d.startScene(s, createRng(s.rngState));
    expect(s.stage.fallback).toBeUndefined();
    roll.mockRestore();
  });
});
