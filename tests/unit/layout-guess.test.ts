// BG-8..BG-11: the Weaver named a tavern place and used its layout's keys (tavern.common, tavern.bar) without naming the
// layout, so every link, slot and trigger pointed at zones that were never built and scene planning failed.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { expandLayouts } from '../../src/scene/validate';
import { LY } from '../../src/library/tableIds';
import type { StagePlan } from '../../src/types';

const plan = (refs: string[]) => ({
  places: [{ key: 'tavern', name: 'The Bent Nail', kind: 'tavern', parent: '' }],
  zones: [{ key: 'lane', place: 'tavern', kind: 'ZK5', name: 'Mill Lane', look: 'mud', links: refs.map((to) => ({ to, label: 'the door', sight: false })) }],
}) as unknown as StagePlan;

it('a place of a layout building whose layout keys the plan uses gets that layout', () => {
  makeVillage();
  const p = plan(['tavern.bar']);
  expandLayouts(p);
  expect(p.places[0].layout).toBe(LY.tavern);
  expect(p.zones.map((z) => z.key)).toContain('tavern.common');
});

it('a place that uses none of the layout keys is left alone', () => {
  makeVillage();
  const p = plan(['lane2']);
  expandLayouts(p);
  expect(p.places[0].layout).toBeUndefined();
  expect(p.zones).toHaveLength(1);
});
