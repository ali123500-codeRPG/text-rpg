// 358 BG-288 (BF95 a): in deck playtest run 17 the hero took the unexplored road north-west, and the World builder built a
// second copy of the road the last hero arrived on: it linked its crossways to that road, but the road was off the stage,
// so the link was refused, and the repair declared the road again (nwroad_2). New ground may now link to ground already
// built off the stage, which comes back on the stage; a second zone for a built road is refused; and a newcomer's staged
// settlement keeps its ways to built ground elsewhere as ways back in (re-entry), so walking them loads that ground.
import { expect, it } from 'vitest';
import type { GameState, StagePlan, Zone } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan, stageSettlement } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { zoneById } from '../../src/engine/relations';
import { isSavedZone } from '../../src/scenario/stage';
import { ZK } from '../../src/library/tableIds';

/** the square is built ground off the stage (saved on its place, as after the player left it) */
const offStage = (s: GameState, id: string) => {
  s.stage.zoneIds = s.stage.zoneIds.filter((x) => x !== id);
  s.zones.splice(s.zones.indexOf(zoneById(s, id)!), 1);
};
const ctx = { kind: 'extension' as const, tier: 'success' as const, placeId: 'field', frontierKey: 'woods' };
const glade = (more: Partial<StagePlan['zones'][number]> = {}): StagePlan => ({ ...grovePlan(), zones: [{ key: 'glade', place: 'field', kind: ZK.yard, name: 'the glade', look: 'a glade', links: [{ to: 'street_square', label: 'a path round to the square', sight: true }], ...more }] });

it('a plan may link to built ground off the stage: no bad link, and that ground comes back on the stage joined to it', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  offStage(s, 'street_square');
  expect(validateStagePlan(s, glade(), ctx).map((e) => e.code)).not.toContain('bad_link');
  applyStagePlan(s, glade(), ctx, { entry: 'open' }, createRng(1));
  const g = s.zones.find((z) => z.name === 'the glade')!;
  expect(s.stage.zoneIds).toContain('street_square');
  expect(zoneById(s, 'street_square')!.links.some((l) => l.to === g.id && !l.frontier)).toBe(true); // its way back
  expect(s.places.flatMap((p) => p.zones).filter((z) => z.name === zoneById(s, 'street_square')!.name)).toHaveLength(1); // no copy
});

it('a second zone for a road of the land that is already built is refused: link to it instead', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  s.regions = [{ id: 'rg', roads: [{ id: 'rg_r1', kind: 'road', length: 1700, danger: 'quiet', zone: 'street_square' }] }] as never;
  const codes = validateStagePlan(s, glade({ road: 'rg_r1' } as never), ctx).map((e) => e.code);
  expect(codes).toContain('road_built');
});

it('a newcomer\'s staged settlement keeps its ways to built ground elsewhere as ways back in', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  // a road built by an earlier character, in a place of its own, linked from the gate
  const road: Zone = { ...structuredClone(zoneById(s, 'field_far')!), id: 'far_road', placeId: 'far_place', name: 'the far road', links: [{ to: 'gate_inner', label: 'back to the gate', sight: true }] };
  s.places.push({ ...structuredClone(s.places.find((p) => p.id === 'field')!), id: 'far_place', parentId: null, zones: [road] });
  zoneById(s, 'gate_inner')!.links.push({ to: 'far_road', label: 'the far road', sight: true });
  s.stage.zoneIds = []; s.zones.splice(0);
  stageSettlement(s, 'tavern');
  expect(s.stage.zoneIds).not.toContain('far_road');
  expect(zoneById(s, 'gate_inner')!.links.find((l) => l.to === 'far_road')!.frontier).toBe(true);
  expect(isSavedZone(s, 'far_road')).toBe(true); // crossing it loads it (crossTo), no Weaver call
});
