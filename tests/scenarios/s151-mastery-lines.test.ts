// 151 tree mastery achievements by tree rating: normal, superior and legendary trees each have their own line, grander the
// higher the rating, at the same steps and reward levels; inferior trees earn none.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAllSteps } from '../../src/ruleset/allSteps';
import { achievementName } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { MASTERY_ACH } from '../../src/library/achievementIds';
import { TR } from '../../src/library/treeIds';

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

  it('a legendary tree grants the legendary line, named for the tree', () => {
    const s = makeVillage();
    const tree = getLibrary().trees[TR.armor];
    const was = tree.rating;
    tree.rating = 'legendary';
    try {
      s.player.core.skills[tree.skills[0]] = { raw: 100, state: 'normal' };
      grantAllSteps(s, s.player);
      const got = (s.player.progression!.achievements ?? []).filter((x) => x.of === TR.armor);
      expect(got.map((x) => x.key)).toEqual([MASTERY_ACH.legendary![50], MASTERY_ACH.legendary![100]]);
      expect(achievementName(s, got[1])).toBe(`${tree.name} Incarnate`);
    } finally { if (was) tree.rating = was; else delete tree.rating; }
  });
});
