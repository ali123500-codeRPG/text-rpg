// 29 The fight spills outside: an engaged NPC follows the player from the bar into the street;
// its placeId changes with its zone, and the turn stays Tactical. CH5: a patron's template keeps it to its own place (post),
// so its band here is given the near range, as the Weaver would for a brawl that spills out.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng, actor } from '../harness';
import { computePending, resolveTurn } from '../../src/engine';

describe('29 The fight spills outside', () => {
  it('the engaged patron follows into the street and changes place', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    s.mode = 'tactical';
    const wim = actor(s, 'patron_1');
    wim.mind!.overrides = { player: 'hostile' };
    s.bands.find((b) => b.id === 'tavern_folk')!.chase = 'near';
    wim.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_door', lastSeenTurn: 1, source: 'seen', revealed: [] };
    expect(wim.placeId).toBe('tavern');
    resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
    expect(wim.zone).toBe('street_door');
    expect(wim.placeId).toBe('street');
    expect(computePending(s).mode).toBe('tactical');
  });
  it('CH5: with its template\'s post range, the patron stays in the tavern', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    s.mode = 'tactical';
    const wim = actor(s, 'patron_1');
    wim.mind!.overrides = { player: 'hostile' };
    wim.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_door', lastSeenTurn: 1, source: 'seen', revealed: [] };
    resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
    expect(wim.placeId).toBe('tavern');
  });
});
