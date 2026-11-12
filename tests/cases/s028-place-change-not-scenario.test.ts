// 28 Place change is not a scenario: bar zone -> street zone (two places, one stage): no event roll, no Weaver call.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { resolveTurn } from '../../src/engine';
import { ScenarioDirector } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';

describe('28 Place change is not a scenario', () => {
  it('walking from the tavern to the street rolls nothing and calls no Weaver', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const roll = vi.spyOn(ruleset, 'eventRoll');
    const weave = vi.fn(async () => null);
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    const intent = { move: { toZone: 'street_door' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
    resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
    expect(s.player.zone).toBe('street_door');
    expect(s.player.placeId).toBe('street');
    expect(d.afterSave(s)).toEqual([]);
    expect(roll).not.toHaveBeenCalled();
    expect(weave).not.toHaveBeenCalled();
    expect(s.stage.scenarioNumber).toBe(1);
    roll.mockRestore();
  });
});
