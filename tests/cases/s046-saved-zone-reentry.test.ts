// 46 Built ground stays live (WI8 a, which replaces saved zone re-entry): the stage keeps no list of zones, so ground built
// in an earlier story is as live as the rest (old saves with re-entry marks are not loaded, PZ16 b). The planners see the ground near the player (PLAN_VIEW_M metres by the walking path, BG-305);
// ground further off is still there to link to.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage } from '../harness';
import { ScenarioDirector, frontiersNearPlayer, nearbyZones } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';
import { loadStory, memoryStore, saveTurn } from '../../src/save';
import { getLibrary } from '../../src/library';
import { zoneById } from '../../src/engine/relations';
import type { TurnRecord } from '../../src/types';
import { middle, waysOut, wayTo } from '../../src/plan/where';
import { drawTitles } from '../../src/plan/draw';

describe('46 Built ground stays live', () => {
  it('the planners see the village around the player; ground past PLAN_VIEW_M stays out of view', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const at = (z: string) => ({ zone: z, pos: middle(zoneById(s, z)!) });
    const near = nearbyZones(s, [at('tav_common')]).map((z) => z.id);
    expect(near).toEqual(expect.arrayContaining(['tav_common', 'street_square', 'field_far'])); // the village lies within PLAN_VIEW_M of it by the walk (BG-1615: by metres, never by place)
    // field_far spans x 130 to 170: the road runs on east of it, 60 m, then its end 40 m (metres decide, BG-305)
    s.places.push({ ...structuredClone(s.places.find((p) => p.id === 'field')!), id: 'far_place', parentId: null, zones: [] });
    drawTitles(s, [
      { id: 'far_road', placeId: 'far_place', name: 'far road', look: '', roof: false, rect: { x: 200, y: -14, w: 60, d: 40 }, ways: [{ to: 'field_far', label: 'back', back: 'the far road', kind: 'open' }, { to: 'far_end', label: 'on', kind: 'open' }] },
      { id: 'far_end', placeId: 'far_place', name: 'far end', look: '', roof: false, rect: { x: 250, y: -14, w: 40, d: 40 }, ways: [{ to: 'far_road', label: 'back', kind: 'open' }] },
    ]);
    expect(nearbyZones(s, [at('field_far')]).map((z) => z.id)).toEqual(expect.arrayContaining(['far_road', 'far_end'])); // within 200 m by the walk
    expect(nearbyZones(s, [at('tav_common')]).map((z) => z.id)).not.toContain('far_end'); // about 250 m away
  });
});
