// 206 NW4, NW6: NPCs stay in the world. The Weaver sees the stage sorted by place (each place named, with its areas
// and the people in them) and where the player stands, so it plans in the right town without hiding anyone (NW6).
// A street, square, gate, field or woods leads onward (a road is a line on the land, PZ9): besides the way in, it links to another zone or a
// frontier, so the scenario builder never leaves a dead-end street (NW4); the repair retry fixes a miss.
import { describe, expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario/validate';
import { ZK } from '../../src/library/tableIds';

const quiet = () => makeVillage({ without: ['slime_1', 'slime_2', 'patron_1'] });
type Zone = StagePlan['zones'][number];
const plan = (zones: Zone[], frontiers: StagePlan['frontiers'] = []): StagePlan => ({
  event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], frontiers, bands: [], rewards: [], hiddenTerms: [], weaverNote: '',
  zones, cast: [], seeds: { plans: [], triggers: [], secrets: [] },
});
const zone = (key: string, kind: string, links: [string, string][]): Zone =>
  ({ key, place: 'street', kind, name: key, look: 'a place', ways: links.map(([to, label]) => ({ to, label })) });
const deadEnds = (p: StagePlan, ctx: Partial<Parameters<typeof validateStagePlan>[2]> = {}) =>
  validateStagePlan(quiet(), p, { kind: 'extension', tier: 'success', placeId: 'street', ...ctx }).filter((e) => e.code === 'dead_end');

describe('206 NPCs stay in the world (NW4, NW6)', () => {
  it('NW4: a street with only its way in is a dead end; one more link or a frontier fixes it', () => {
    expect(deadEnds(plan([zone('tanners_row', ZK.street, [['street_square', 'back to the square']])]))).toHaveLength(1);
    expect(deadEnds(plan([zone('tanners_row', ZK.street, [['street_square', 'back to the square'], ['east_road', 'the east road']])],
      [{ key: 'east_road', label: 'the east road' }]))).toEqual([]);
    expect(deadEnds(plan([
      zone('tanners_row', ZK.street, [['street_square', 'back to the square'], ['tannery', 'into the tannery']]),
      zone('tannery', ZK.room, [['tanners_row', 'out to the street']]),
    ]))).toEqual([]);
  });
  it('NW4: an extension\'s entry counts the way it was entered by', () => {
    // field_far's frontier "woods" leads in; the woods zone needs one more way on
    expect(deadEnds(plan([zone('woods_edge', ZK.woods, [])]), { frontierKey: 'woods', placeId: 'field' })).toHaveLength(1);
    expect(deadEnds(plan([zone('woods_edge', ZK.woods, [['deep_woods', 'deeper in']])], [{ key: 'deep_woods', label: 'deeper in' }]),
      { frontierKey: 'woods', placeId: 'field' })).toEqual([]);
  });
});
