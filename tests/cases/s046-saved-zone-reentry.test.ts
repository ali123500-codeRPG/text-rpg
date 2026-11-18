// 46 Built ground stays live (WI8 a, which replaces saved zone re-entry): the stage keeps no list of zones, so ground built
// in an earlier story is as live as the rest. A save whose ways into built ground still carry the old re-entry mark loads
// them as plain ways, and no Weaver call is started for them. The planners see the ground near the player (PLAN_VIEW_M metres by the walking path, BG-305);
// ground further off is still there to link to.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage } from '../harness';
import { ScenarioDirector, frontiersNearPlayer, nearbyZones } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';
import { loadStory, memoryStore, saveTurn } from '../../src/save';
import { getLibrary } from '../../src/library';
import { zoneById } from '../../src/engine/relations';
import type { TurnRecord } from '../../src/types';

describe('46 Built ground stays live', () => {
  it('an old re-entry mark loads as a plain way; no Weaver call for it', async () => {
    const s = makeVillage({ playerZone: 'gate_inner' });
    zoneById(s, 'gate_inner')!.links.find((l) => l.to === 'field_edge')!.frontier = true; // as the old stage left it
    const st = memoryStore();
    await saveTurn(st, s, { storyId: s.storyId, turn: 0, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] } as TurnRecord);
    const { state } = await loadStory(st, s.storyId, getLibrary());
    expect(zoneById(state, 'gate_inner')!.links.find((l) => l.to === 'field_edge')!.frontier).toBeUndefined();
    expect(frontiersNearPlayer(state)).toEqual([]);
    const weave = vi.fn(async () => null);
    expect(new ScenarioDirector({ weave, clock: new VirtualClock() }).afterSave(state)).toEqual([]);
    expect(state.zones).toHaveLength(state.places.flatMap((p) => p.zones).length); // every built zone is live
  });

  it('the planners see the village around the player; ground past PLAN_VIEW_M stays out of view', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const near = nearbyZones(s, ['tav_common'], ['tavern']).map((z) => z.id);
    expect(near).toEqual(expect.arrayContaining(['tav_common', 'street_square', 'field_far'])); // the whole village
    // field_far spans x 130 to 170: the road runs on east of it, 60 m, then its end 40 m (metres decide, BG-305)
    const far = { ...structuredClone(zoneById(s, 'field_far')!), id: 'far_road', placeId: 'far_place', rect: { x: 200, y: -14, w: 60, d: 40 }, ways: [{ to: 'field_far', label: 'back' }] };
    s.places.push({ ...structuredClone(s.places.find((p) => p.id === 'field')!), id: 'far_place', parentId: null, zones: [far] });
    s.zones.push(far);
    const end = { ...structuredClone(far), id: 'far_end', rect: { x: 250, y: -14, w: 40, d: 40 }, ways: [{ to: 'far_road', label: 'back' }] };
    s.places.find((p) => p.id === 'far_place')!.zones.push(end); s.zones.push(end);
    far.links.push({ to: 'far_end', label: 'on' });
    zoneById(s, 'field_far')!.links.push({ to: 'far_road', label: 'the far road' });
    expect(nearbyZones(s, ['field_far'], ['field']).map((z) => z.id)).toEqual(expect.arrayContaining(['far_road', 'far_end'])); // within 200 m by the walk
    expect(nearbyZones(s, ['tav_common'], ['tavern']).map((z) => z.id)).not.toContain('far_end'); // about 250 m away
  });
});
