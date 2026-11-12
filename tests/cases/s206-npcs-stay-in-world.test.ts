// 206 NW4, NW6: NPCs stay in the world. The Weaver sees the stage sorted by place (each place named, with its areas
// and the people in them) and where the player stands, so it plans in the right town without hiding anyone (NW6).
// A street, square, gate, field, woods or road leads onward: besides the way in, it links to another zone or a
// frontier, so the scenario builder never leaves a dead-end street (NW4); the repair retry fixes a miss.
import { describe, expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { makeVillage } from '../harness';
import { buildWeaverView } from '../../src/views';
import { validateStagePlan } from '../../src/scenario/validate';
import { getLibrary } from '../../src/library';
import { ZK } from '../../src/library/tableIds';

const quiet = () => makeVillage({ without: ['slime_1', 'slime_2', 'patron_1'] });
type Zone = StagePlan['zones'][number];
const plan = (zones: Zone[], frontiers: StagePlan['frontiers'] = []): StagePlan => ({
  event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], frontiers, bands: [], rewards: [], hiddenTerms: [], weaverNote: '',
  zones, cast: [], seeds: { plans: [], triggers: [], secrets: [] },
});
const zone = (key: string, kind: string, links: [string, string][]): Zone =>
  ({ key, place: 'street', kind, name: key, look: 'a place', links: links.map(([to, label]) => ({ to, label, sight: true })) });
const deadEnds = (p: StagePlan, ctx: Partial<Parameters<typeof validateStagePlan>[2]> = {}) =>
  validateStagePlan(quiet(), p, { kind: 'extension', tier: 'success', placeId: 'street', ...ctx }).filter((e) => e.code === 'dead_end');

describe('206 NPCs stay in the world (NW4, NW6)', () => {
  it('NW4: the onward kinds are marked on the zone kinds table', () => {
    makeVillage();
    const onward = Object.values(getLibrary().zoneKinds ?? {}).filter((k) => k.onward).map((k) => k.id).sort();
    expect(onward).toEqual([ZK.street, ZK.square, ZK.gate, ZK.field, ZK.woods, ZK.road].sort());
  });
  it('NW4: a street with only its way in is a dead end; one more link or a frontier fixes it', () => {
    expect(deadEnds(plan([zone('tanners_row', ZK.street, [['street_square', 'back to the square']])]))).toHaveLength(1);
    expect(deadEnds(plan([zone('tanners_row', ZK.street, [['street_square', 'back to the square'], ['east_road', 'the east road']])],
      [{ key: 'east_road', label: 'the east road' }]))).toEqual([]);
    expect(deadEnds(plan([
      zone('tanners_row', ZK.street, [['street_square', 'back to the square'], ['tannery', 'into the tannery']]),
      zone('tannery', ZK.room, [['tanners_row', 'out to the street']]),
    ]))).toEqual([]);
  });
  it('NW4: yards and rooms may be dead ends; a way in from another new zone counts', () => {
    expect(deadEnds(plan([zone('back_yard', ZK.yard, [['street_square', 'back to the square']])]))).toEqual([]);
    // the alley's only listed link is onward; its way in is the square's link to it
    expect(deadEnds(plan([
      zone('little_square', ZK.square, [['street_square', 'back up the street'], ['alley', 'the alley']]),
      zone('alley', ZK.street, [['far_gate', 'the far gate']]),
    ], [{ key: 'far_gate', label: 'the far gate' }]))).toEqual([]);
  });
  it('NW4: an extension\'s entry counts the way it was entered by', () => {
    // field_far's frontier "woods" leads in; the woods zone needs one more way on
    expect(deadEnds(plan([zone('woods_edge', ZK.woods, [])]), { frontierKey: 'woods', placeId: 'field' })).toHaveLength(1);
    expect(deadEnds(plan([zone('woods_edge', ZK.woods, [['deep_woods', 'deeper in']])], [{ key: 'deep_woods', label: 'deeper in' }]),
      { frontierKey: 'woods', placeId: 'field' })).toEqual([]);
  });
  it('NW6: the Weaver sees every place by name, its areas and its people, and where the player stands', () => {
    const s = quiet();
    const v = buildWeaverView(s, { kind: 'scenario', placeId: 'gate' });
    expect(v.target).toMatchObject({ placeId: 'gate', placeName: 'the village gate' });
    expect(v.player.standsIn).toEqual({ place: 'tavern', placeName: 'The Crooked Kettle', area: 'tav_common' });
    const tavern = v.places.find((p) => p.id === 'tavern')!;
    expect(tavern).toMatchObject({ name: 'The Crooked Kettle', parent: { id: 'village', name: 'Brookmere' } });
    expect(tavern.areas.map((a) => a.id).sort()).toEqual(['tav_cellar', 'tav_common', 'tav_counter']);
    // nobody is hidden: every NPC on the stage is listed under the place of its zone
    const people = v.places.flatMap((p) => p.people.map((x) => [x.id, p.id]));
    expect(people.map(([id]) => id).sort()).toEqual(s.actors.filter((a) => s.stage.zoneIds.includes(a.zone)).map((a) => a.id).sort());
    for (const [id, place] of people) expect(s.actors.find((a) => a.id === id)!.placeId).toBe(place);
  });
});
