// 361 WI1 a (BG-273, BG-288): a place or area is built once in a world. A plan that declares one whose key is already built
// (on the stage or off it, any plan, not only a newcomer's) is refused and sent back for repair; code never builds a copy
// under a new id (tavern_2, nwroad_2). The bare start place (BG-32) is still filled in by the plan's place of the same key.
import { expect, it } from 'vitest';
import type { GameState, StagePlan } from '../../src/types';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { zoneById } from '../../src/engine/relations';
import { ZK } from '../../src/library/tableIds';

const ctx = { kind: 'extension' as const, tier: 'success' as const, placeId: 'field', frontierKey: 'woods' };
const codes = (s: GameState, plan: StagePlan) => validateStagePlan(s, plan, ctx).map((e) => e.code);
const offStage = (s: GameState, id: string) => {
  s.stage.zoneIds = s.stage.zoneIds.filter((x) => x !== id);
  s.zones.splice(s.zones.indexOf(zoneById(s, id)!), 1);
};
/** a new zone keyed `key`, linked to the field */
const declare = (key: string): StagePlan => ({ ...grovePlan(), zones: [{ key, place: 'field', kind: ZK.yard, name: 'a yard', look: 'a yard', links: [{ to: 'field_far', label: 'back to the field', sight: true }] }] });

it('an extension that declares an area already built on the stage is refused', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  expect(codes(s, declare('street_square'))).toContain('zone_exists');
});

it('an area built but off the stage is refused too, and the message says to link to it', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  offStage(s, 'street_square');
  const e = validateStagePlan(s, declare('street_square'), ctx).find((x) => x.code === 'zone_exists');
  expect(e?.message).toContain('link to street_square');
});

it('a place already built is refused; a new key is accepted', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  const plan = { ...declare('yard'), places: [{ key: 'tavern', kind: 'place', name: 'an inn', parent: 'village' }] } as unknown as StagePlan;
  expect(codes(s, plan)).toContain('place_exists');
  expect(codes(s, declare('yard'))).not.toEqual(expect.arrayContaining(['zone_exists', 'place_exists']));
});

it('the bare start place is filled in, not refused (BG-32)', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  s.places.find((p) => p.id === 'tavern')!.bare = true;
  const plan = { ...declare('yard'), places: [{ key: 'tavern', kind: 'place', name: 'an inn', parent: 'village' }] } as unknown as StagePlan;
  expect(codes(s, plan)).not.toContain('place_exists');
});
