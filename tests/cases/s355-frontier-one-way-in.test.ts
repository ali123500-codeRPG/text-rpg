// 355 BG-285: in deck playtest run 16 the causeway listed "the cottage row" twice (Go to, Look at). When the frontier
// toward the cottages was built, the cottage row's own way back to the causeway first got a way back added on the
// causeway (named after the zone), and only then was the frontier joined, turning it into a second way to the same zone.
// The frontier is now joined first (old saves with the twin are not loaded, PZ16 b).
import { expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan } from '../../src/scenario/apply';
import { grovePlan } from '../../src/scenario/fixtures';
import { getLibrary } from '../../src/library';
import { waysOut } from '../../src/plan/where';

it('a built frontier whose entry names the way back leaves one way in, named as the frontier was', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  const kind = Object.keys(getLibrary().zoneKinds ?? {})[0];
  const p: StagePlan = grovePlan();
  p.zones = [{ key: 'glade', place: 'field', kind, name: 'the glade', look: 'a glade', ways: [{ to: 'field_far', label: 'back to the field' }] }];
  const label = waysOut(s, 'field_far').find((l) => l.to === 'woods')!.label;
  applyStagePlan(s, p, { kind: 'extension', tier: 'success', placeId: 'field', frontierKey: 'woods' }, { entry: 'open' }, createRng(1));
  const glade = s.zones.find((z) => z.name === 'the glade')!;
  const ways = waysOut(s, 'field_far').filter((l) => l.to === glade.id);
  expect(ways).toHaveLength(1);
  expect(ways[0].label).toBe(label);
});
