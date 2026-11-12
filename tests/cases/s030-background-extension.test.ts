// 30 Background extension: with the player in a zone linked to a frontier, one Weaver call starts after the save,
// and is not applied before the player crosses. (The agent log entry is written by the pipeline's weave wrapper, W7.)
import { describe, expect, it, vi } from 'vitest';
import { makeVillage } from '../harness';
import type { WeaverView } from '../../src/types';
import { ScenarioDirector } from '../../src/scenario';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';

describe('30 Background extension', () => {
  it('starts one call for the frontier and holds the result', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const weave = vi.fn(async (_v: WeaverView) => grovePlan());
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    expect(d.afterSave(s)).toEqual(['woods']);
    expect(weave).toHaveBeenCalledTimes(1);
    expect(weave.mock.calls[0][0].target).toMatchObject({ kind: 'frontier', frontierKey: 'woods' });
    await Promise.resolve();
    d.afterSave(s); // next turn, still beside the frontier: no second call
    expect(weave).toHaveBeenCalledTimes(1);
    expect(d.heldKeys()).toEqual(['woods']);
    expect(s.stage.zoneIds).not.toContain('grove');
    expect(s.zones.find((z) => z.id === 'field_far')!.links.find((l) => l.to === 'woods')!.frontier).toBe(true);
  });
});
