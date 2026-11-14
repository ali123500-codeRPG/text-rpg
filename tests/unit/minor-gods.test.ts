// Every current god is a minor god: grand to the average person, but the minimum for the divine. The Divine NPC rank and
// the divine task grade sit at 400, that minimum.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { GD } from '../../src/library/godIds';
import { rankRow } from '../../src/library/spawn';
import { GOD_RANKS } from '../../src/scales';

describe('minor gods and the divine minimum', () => {
  it('every god has a standing on GOD_RANKS, and the current gods are minor gods', () => {
    const gods = getLibrary().gods ?? {};
    for (const g of Object.values(gods)) expect(GOD_RANKS.has(g.rank), g.id).toBe(true);
    expect([gods[GD.varo]?.rank, gods[GD.essences]?.rank]).toEqual(['minor', 'minor']);
    expect(GOD_RANKS.name('minor')).toBe('Minor god');
  });
  it('the Divine rank and the divine task grade sit at 400', () => {
    expect(rankRow('rank_8').anchor).toBe(400);
    expect(CONFIG.DIFFICULTY.divine).toBe(400);
  });
});
