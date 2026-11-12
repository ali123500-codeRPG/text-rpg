// 34 Fallback is flagged: a plan that fails twice yields the fallback stage, and all four flags appear:
// stage record, weaver_fallback log, GM banner, play-screen marker. The banner and the marker are drawn by
// the UI from stage.fallback (GmSnapshot.fallbackBanner / Notice scenario_fallback, W7/W8); this test checks their source.
import { ZK } from '../../src/library/tableIds';
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { ruleset } from '../../src/ruleset';
import { ScenarioDirector } from '../../src/scenario';
import { villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';

describe('34 Fallback is flagged', () => {
  it('two failed plans give the flagged fallback stage until the next scenario start', async () => {
    const roll = vi.spyOn(ruleset, 'eventRoll').mockReturnValue({ actorId: 'player', roll: 60, tier: 'success', modifiers: [] });
    const s = makeVillage();
    s.turn = 5;
    const bad: StagePlan = { ...villageStagePlan('success'), event: { summary: 'x', challenge: 'none', gain: 'extreme' } };
    const weave = vi.fn(async () => bad);
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    const nActors = s.actors.length;
    const r = await d.startScenario(s, createRng(s.rngState));
    expect(weave).toHaveBeenCalledTimes(2);
    expect(r.outcome).toBe('fallback');
    expect(s.stage.fallback).toEqual({ reason: 'invalid_plan', turn: 5 });
    const entry = s.log.find((l) => l.code === 'weaver_fallback')!;
    expect(entry.detail!.errors).toEqual([expect.objectContaining({ code: 'grades_misfit' })]);
    expect(s.hidden.stage).toMatchObject({ challenge: 'none', gain: 'none' });
    expect(s.actors).toHaveLength(nActors); // no new cast
    expect(s.stage.zoneIds).toContain('tav_common'); // the place's saved zones

    // the flags stay until the next scenario start
    weave.mockResolvedValue(null as never);
    weave.mockResolvedValueOnce({ ...villageStagePlan('success'), places: [], bands: [], cast: [], rewards: [], frontiers: [], hiddenTerms: [],
      zones: [{ key: 'snug', place: 'tavern', kind: ZK.room, name: 'the snug', look: 'a cramped side room', cover: 'some', light: 'dim', links: [{ to: 'tav_common', label: 'the common room', sight: true }] }] });
    s.turn = 9;
    await d.startScenario(s, createRng(s.rngState));
    expect(s.stage.fallback).toBeUndefined();
    roll.mockRestore();
  });
});
