// 151 tree mastery achievements by tree rating: normal, superior and legendary trees each have their own line, grander the
// higher the rating, at the same steps and reward levels; inferior trees earn none.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { MASTERY_ACH } from '../../src/library/achievementIds';

describe('151 mastery lines by tree rating', () => {
  it('each rating line has the same steps and reward levels', () => {
    const a = getLibrary().achievements!;
    for (const r of ['normal', 'superior', 'legendary']) {
      const line = MASTERY_ACH[r]!;
      expect(Object.keys(line).map(Number)).toEqual([50, 100, 150]);
      expect(Object.values(line).map((id) => a[id].level)).toEqual(['ii', 'iii', 'iv']);
      expect(a[line[100]].after).toBe(line[50]);
      expect(a[line[150]].after).toBe(line[100]);
    }
    expect(MASTERY_ACH.inferior).toBeUndefined();
  });

});
