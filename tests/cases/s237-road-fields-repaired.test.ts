// BG-141 (run 94): the Weaver gave a zone that was not a road kind a length, and that one field sank the whole extension,
// so the player got a bare, dead-end square. A length or danger on a zone that is not a road is dropped as a repair.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';

it('BG-141: road fields on a zone that is not a road are dropped, not fatal', () => {
  const p = villageStagePlan();
  const z = p.zones[0] as { length?: unknown; danger?: unknown };
  z.length = 'a short walk';
  const errs = validateStagePlan(toStoryStart(makeVillage()), p, { tier: 'success', kind: 'scenario', placeId: 'tavern' });
  expect(errs.filter((e) => !e.repaired)).toEqual([]);
  expect(errs).toContainEqual(expect.objectContaining({ code: 'road_fields_dropped', repaired: true }));
  expect(z.length).toBeUndefined();
});
