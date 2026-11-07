// 28 Place change is not a scene: bar zone -> street zone (two places, one stage): no situation roll, no Weaver call.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { resolveTurn } from '../../src/engine';
import { SceneDirector } from '../../src/scene';
import { VirtualClock } from '../../src/scene/fixtures';

describe('28 Place change is not a scene', () => {
  it('walking from the tavern to the street rolls nothing and calls no Weaver', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const roll = vi.spyOn(ruleset, 'situation');
    const weave = vi.fn(async () => null);
    const d = new SceneDirector({ weave, clock: new VirtualClock() });
    const intent = { move: { toZone: 'street_door' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
    resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
    expect(s.player.zone).toBe('street_door');
    expect(s.player.placeId).toBe('street');
    expect(d.afterSave(s)).toEqual([]);
    expect(roll).not.toHaveBeenCalled();
    expect(weave).not.toHaveBeenCalled();
    expect(s.stage.sceneNumber).toBe(1);
    roll.mockRestore();
  });
});
