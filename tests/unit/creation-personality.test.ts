// PL14: the creation screen's personality picks reach the player's sheet, and bad picks are refused.
import { describe, expect, it } from 'vitest';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { PA, VL } from '../../src/library/tableIds';
import { nerveLine, personalityOf, traitWords } from '../../src/ruleset/personality';

const base = () => ({ ...recommendedBuild(), name: 'Aldric' });

describe('creation personality (PL14)', () => {
  it('keeps the picks on the new player', () => {
    const b = { ...base(), personality: { nerve: 40, traits: { [PA.honesty]: 50 }, values: [VL.duty] } };
    expect(validateBuild(b)).toEqual([]);
    const p = createPlayer(b, 's');
    expect(nerveLine(personalityOf(p))).toBe('daring');
    expect(traitWords(personalityOf(p))).toEqual(['honest']);
    expect(personalityOf(p).values).toEqual([VL.duty]);
  });

});
