import { expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { validateRoutineBank } from '../../src/minds';

it('74 Import rejects: a shared routine that reads slot counter is not promoted; the error names the slot', () => {
  const L = structuredClone(getLibrary());
  L.routines.mind_counter = { id: 'mind_counter', brief: 'Minds a counter', kind: 'schedule', loop: true, steps: [{ slot: 'counter', duration: 'long', activity: 'tend_counter' }], onAlert: null };
  for (const set of ['barkeep', 'patron']) {
    L.routineSets[set].routines.push('mind_counter');
    L.routineSets[set].slots.counter = { kind: 'zone', hint: 'a counter' };
  }
  const r = validateRoutineBank({ routines: L.routines, sets: L.routineSets, activities: L.activities });
  expect(r.ok).toBe(false);
  expect(r.errors).toEqual([expect.stringMatching(/mind_counter.*non-standard slot counter/)]);
});
