// 30 Background extension: with the player in a zone linked to a frontier, one Weaver call starts after the save,
// and is not applied before the player crosses. (The agent log entry is written by the pipeline's weave wrapper, W7.)
// 32 Late extension: the player crosses before the extension returns; the turn waits for it, and no fallback is used.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { WeaverView } from '../../src/types';
import { CONFIG } from '../../src/config';
import { ScenarioDirector } from '../../src/scenario';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';
import { waysOut } from '../../src/plan/where';

describe('30/32 Background extension', () => {
  it('starts one call for the frontier and holds it; a crossing waits for it, however late, and no fallback is used', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const clock = new VirtualClock();
    const late = CONFIG.WEAVER_TIMEOUT_MS * 2; // WEAVER_TIMEOUT is scenario start only
    const weave = vi.fn((_v: WeaverView) => clock.sleep(late).then(() => grovePlan()));
    const d = new ScenarioDirector({ weave, clock });
    expect(d.afterSave(s)).toEqual(['woods']);
    expect(weave).toHaveBeenCalledTimes(1);
    expect(weave.mock.calls[0][0].target).toMatchObject({ kind: 'frontier', frontierKey: 'woods' });
    await Promise.resolve();
    d.afterSave(s); // next turn, still beside the frontier: no second call
    expect(weave).toHaveBeenCalledTimes(1);
    expect(d.heldKeys()).toEqual(['woods']);
    expect(s.zones.map((z) => z.id)).not.toContain('grove');
    expect(waysOut(s, 'field_far').find((l) => l.to === 'woods')!.frontier).toBe(true);
    // 32: the player crosses before it returns
    let done = false;
    const crossing = d.cross(s, 'woods', createRng(s.rngState)).then((r) => ((done = true), r));
    await clock.advance(late - 1);
    expect(done).toBe(false);
    await clock.advance(1);
    const r = await crossing;
    expect(r.outcome).toBe('applied');
    expect(weave).toHaveBeenCalledTimes(1);
    expect(s.stage.fallback).toBeUndefined();
    expect(s.player.zone).toBe('grove');
  });
});
