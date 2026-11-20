// The balance probe (tests/harness/measure.ts): the same scenario and seeds give the same result, the two stand at the
// asked gap, and a gap the title cannot hold stops the run, never measured at another distance.
import { describe, expect, it } from 'vitest';
import { measure, report, type Scenario } from '../harness/measure';
import { searchAreaM2 } from '../../src/minds';
import { makeVillage } from '../harness';

const sc: Scenario = { searcher: { who: 'guard' }, hider: { who: 'thief' }, distanceM: 3, modes: ['search', 'wait'], trials: 4, turns: 2, seed: 7 };

describe('balance probe', () => {
  it('repeats exactly with the same scenario and seeds, at the asked gap', () => {
    const a = measure(sc), b = measure(sc);
    expect(b).toEqual(a);
    expect(a.start.gapM).toBeCloseTo(3, 2);
    expect(a.deviations).toEqual([]);
    expect(a.runs.map((r) => r.mode)).toEqual(['search', 'wait']);
    expect(report(a)).toContain('deviations none');
  });

  it('shows the reach the game uses: the area is searchAreaM2 at the rolled skill', () => {
    const m = measure({ ...sc, trials: 1, modes: ['search'] });
    expect(m.reach.areaM2).toBe(searchAreaM2(makeVillage().player, m.reach.skill));
    expect(m.reach.radiusM).toBeCloseTo(Math.max(2, Math.sqrt(m.reach.areaM2 / Math.PI)), 6);
  });

  it('a gap the title cannot hold stops the run, never a silent other distance (BG-341)', () => {
    expect(() => measure({ ...sc, distanceM: 25, trials: 1, turns: 1, modes: ['wait'] })).toThrow(/cannot stand 25 m/); // the square is 20 m across
  });
});
