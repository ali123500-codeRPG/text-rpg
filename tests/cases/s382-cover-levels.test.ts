// CV1-CV8: five cover levels by the share of a standing person hidden; a roll modifier of COVER_HALVING_MOD for each
// halving of what shows; a ranged attack takes it as a minus, a hide-tagged roll as the same plus.
import { describe, expect, it } from 'vitest';
import { COVER } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { coverMod } from '../../src/ruleset/gear';

describe('382 cover levels (CV1-CV8)', () => {
  it('five levels, each hiding more of a person; a person reads 0, 5, 13, 26, 39', () => {
    const hidden = COVER.keys.map((k) => CONFIG.COVER_HIDDEN[k]);
    expect(hidden.map((h) => coverMod(1 - h))).toEqual([0, 5, 13, 26, 39]);
    expect(coverMod(1)).toBe(0);
  });

});
