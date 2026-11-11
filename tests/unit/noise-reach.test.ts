import { describe, expect, it } from 'vitest';
import { NOISE } from '../../src/scales';
import { noiseReach } from '../../src/perception';

describe('noise reach from decibels', () => {
  it('works out [clear, heard] links for every level from one equation', () => {
    expect(Object.fromEntries(NOISE.keys.map((k) => [k, noiseReach(k)]))).toEqual({
      silent: [-1, -1], faint: [-1, 0], hushed: [0, 0], quiet: [0, 1], murmur: [0, 2],
      normal: [1, 2], raised: [1, 3], loud: [2, 4], blaring: [3, 5], deafening: [5, 7],
    });
  });
  it('never carries a quieter level further than a louder one', () => {
    const r = NOISE.keys.map((k) => noiseReach(k));
    for (let i = 1; i < r.length; i++) { expect(r[i][0]).toBeGreaterThanOrEqual(r[i - 1][0]); expect(r[i][1]).toBeGreaterThanOrEqual(r[i - 1][1]); }
  });
});
