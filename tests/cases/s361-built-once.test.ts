// 361 WI1 a (BG-273, BG-288): a place or area is built once in a world. A plan that declares one whose key is already built
// (anywhere in the world, any plan, not only a newcomer's) is refused and sent back for repair; code never builds a copy
// under a new id (tavern_2, nwroad_2). The bare start place (BG-32) is still filled in by the plan's place of the same key.
import { expect, it } from 'vitest';
import type { GameState, StagePlan } from '../../src/types';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { ZK } from '../../src/library/tableIds';

const ctx = { kind: 'extension' as const, tier: 'success' as const, placeId: 'field', frontierKey: 'woods' };
const codes = (s: GameState, plan: StagePlan) => validateStagePlan(s, plan, ctx).map((e) => e.code);
/** a new zone keyed `key`, linked to the field */
const declare = (key: string): StagePlan => ({ ...grovePlan(), zones: [{ key, place: 'field', kind: ZK.yard, name: 'a yard', look: 'a yard', ways: [{ to: 'field_far', label: 'back to the field' }] }] });

it('an extension that declares an area or place already built is refused, a new key is accepted, and the bare start place is filled in (BG-32)', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  expect(codes(s, declare('street_square'))).toContain('zone_exists');
  const plan = { ...declare('yard'), places: [{ key: 'tavern', kind: 'place', name: 'an inn', parent: 'village' }] } as unknown as StagePlan;
  expect(codes(s, plan)).toContain('place_exists');
  expect(codes(s, declare('yard'))).not.toEqual(expect.arrayContaining(['zone_exists', 'place_exists']));
  s.places.find((p) => p.id === 'tavern')!.bare = true;
  expect(codes(s, plan)).not.toContain('place_exists');
});
