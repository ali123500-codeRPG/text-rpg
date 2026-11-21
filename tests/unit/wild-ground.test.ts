// D-245 a: a long walk's minutes on open land off the road count toward a leg, and a leg that fills there rolls at the wild
// rate. Open land is a region point whose land cover is not a settlement. Needed: the trip tests run on hand-built roads
// with no land under them, so nothing else reaches this rule.
import { describe, expect, it } from 'vitest';
import { landed } from '../harness/land';
import { wildGround } from '../../src/engine/travel';
import type { Region } from '../../src/types';

describe('wild ground (D-245 a)', () => {
  it('open land is a region cell whose cover is not a settlement; a settlement cell, a region with no cover and no region are not', () => {
    const s = landed();
    expect(wildGround(s, { x: 5050, y: 5050 })).toBe(false); // the test regions are drawn with no cover
    const r = s.regions![0] as Region, n = r.size / r.cell;
    const cover = Array(n * n).fill('3'); // woods (LC3)
    cover[50 * n + 50] = '8'; // a settlement cell (LC8) at 5000-5100 m
    r.cover = cover.join('');
    expect(wildGround(s, { x: 5050, y: 5050 })).toBe(false);
    expect(wildGround(s, { x: 3050, y: 5050 })).toBe(true);
    expect(wildGround(s, { x: -50, y: 5050 })).toBe(false); // no region there
  });
});
