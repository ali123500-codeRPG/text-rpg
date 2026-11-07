// 31 Crossing reuses the tier: crossing applies the held extension with the scene's tier; no situation roll is made.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { WeaverView } from '../../src/types';
import { ruleset, tierIdOf } from '../../src/ruleset';
import { SceneDirector } from '../../src/scene';
import { grovePlan, VirtualClock } from '../../src/scene/fixtures';

describe('31 Crossing reuses the tier', () => {
  it('applies the held plan under the scene tier', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    s.stage.tier = -2;
    const roll = vi.spyOn(ruleset, 'situation');
    const weave = vi.fn(async (v: WeaverView) => grovePlan(tierIdOf(v.tier)!));
    const d = new SceneDirector({ weave, clock: new VirtualClock() });
    d.afterSave(s);
    const r = await d.cross(s, 'woods', createRng(s.rngState));
    expect(weave.mock.calls[0][0].tier).toBe('Failure');
    expect(r.outcome).toBe('applied');
    expect(s.stage.tier).toBe(-2);
    expect(s.player.zone).toBe('grove');
    expect(roll).not.toHaveBeenCalled();
    roll.mockRestore();
  });
});
