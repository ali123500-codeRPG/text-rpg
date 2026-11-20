// Every current god is a minor god: grand to the average person, but the minimum for the divine.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { GOD_RANKS } from '../../src/scales';

describe('minor gods and the divine minimum', () => {
  it('every god has a standing on GOD_RANKS', () => {
    const gods = getLibrary().gods ?? {};
    for (const g of Object.values(gods)) expect(GOD_RANKS.has(g.rank), g.id).toBe(true);
  });
});
