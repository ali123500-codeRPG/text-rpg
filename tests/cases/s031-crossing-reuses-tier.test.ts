// 31 Crossing reuses the tier: crossing applies the held extension with the scenario's tier; no event roll is made.
import { TIERS } from '../../src/scales';
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { WeaverView } from '../../src/types';
import { ruleset } from '../../src/ruleset';
import { ScenarioDirector } from '../../src/scenario';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';

describe('31 Crossing reuses the tier', () => {
  it('applies the held plan under the scenario tier', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    s.stage.tier = 'failure';
    const roll = vi.spyOn(ruleset, 'eventRoll');
    const weave = vi.fn(async (v: WeaverView) => grovePlan(TIERS.keyOf(v.tier)!));
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    d.afterSave(s);
    const r = await d.cross(s, 'woods', createRng(s.rngState));
    expect(weave.mock.calls[0][0].tier).toBe('Failure');
    expect(r.outcome).toBe('applied');
    expect(s.stage.tier).toBe('failure');
    expect(s.player.zone).toBe('grove');
    expect(roll).not.toHaveBeenCalled();
    roll.mockRestore();
  });
});
