// 358 BG-288 (BF95 a): in deck playtest run 17 the hero took the unexplored road north-west, and the World builder built a
// second copy of the road the last hero arrived on: it linked its crossways to that road, the link was refused, and the
// repair declared the road again (nwroad_2). New ground may link to any built ground (WI8 a: none is off a stage), and a
// second zone for a built road is refused.
import { expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { zoneById } from '../../src/engine/relations';
import { ZK } from '../../src/library/tableIds';
import { waysOut } from '../../src/plan/where';

const ctx = { kind: 'extension' as const, tier: 'success' as const, placeId: 'field', frontierKey: 'woods' };
const glade = (more: Partial<StagePlan['zones'][number]> = {}): StagePlan => ({ ...grovePlan(), zones: [{ key: 'glade', place: 'field', kind: ZK.yard, name: 'the glade', look: 'a glade', ways: [{ to: 'street_square', label: 'a path round to the square' }], ...more }] });

it('a plan may link to built ground: no bad link, and that ground gets its way back, with no copy', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  expect(validateStagePlan(s, glade(), ctx).map((e) => e.code)).not.toContain('bad_link');
  applyStagePlan(s, glade(), ctx, { entry: 'open' }, createRng(1));
  const g = s.zones.find((z) => z.name === 'the glade')!;
  expect(waysOut(s, 'street_square').some((l) => l.to === g.id && !l.frontier)).toBe(true); // its way back
  expect(s.places.flatMap((p) => p.zones).filter((z) => z.name === zoneById(s, 'street_square')!.name)).toHaveLength(1); // no copy
});

it('a second zone for a road of the land that is already built is refused: link to it instead', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  s.regions = [{ id: 'rg', roads: [{ id: 'rg_r1', kind: 'road', length: 1700, danger: 'quiet', zone: 'street_square' }], nodes: [], sites: [] }] as never;
  const codes = validateStagePlan(s, glade({ road: 'rg_r1' } as never), ctx).map((e) => e.code);
  expect(codes).toContain('road_built');
});
