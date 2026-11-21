// 425 The Weaver's reward table (TI-220): a scenario's rewards draw as a kept vow's do, from a table of their own (RW6)
// with the kept-vow table's weights, and every row says which draws it can show in (showsIn; left out, all of them).
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { getLibrary } from '../../src/library';
import { RW } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { drawReward, weaverRewards } from '../../src/engine/rewards';

describe('s425 the Weaver\'s reward table', () => {
  it('RW6 has the kept-vow table\'s weights and draws from the same Items and Threadbound tables', () => {
    const t = getLibrary().rewardTables!;
    expect(t[RW.weaver].rows.map((r) => r.weight)).toEqual(t[RW.vow_kept].rows.map((r) => r.weight));
    expect(t[RW.weaver].rows).toEqual([{ weight: 3, table: RW.weaver_items }, { weight: 1, table: RW.weaver_threadbound }]);
    expect(t[RW.weaver_items].rows).toEqual([{ weight: 1, table: RW.items }]);
    expect(t[RW.weaver_threadbound].rows).toEqual([{ weight: 1, table: RW.threadbound }]);
  });

  it('a row shows only in the draws its showsIn names', () => {
    const t = getLibrary().rewardTables!, kept = t[RW.weaver_items].rows;
    try {
      // a reward for vows only (as skill rewards will be) and one for every draw
      t[RW.weaver_items].rows = [{ weight: 5, item: IT.healing_draught, showsIn: ['vow'] }, { weight: 1, item: IT.bandage }];
      const seen = (from: 'vow' | 'weaver') => new Set(Array.from({ length: 40 }, (_, i) => drawReward(RW.weaver_items, createRng(i + 1), from)?.item));
      expect([...seen('weaver')]).toEqual([IT.bandage]);
      expect(seen('vow').has(IT.healing_draught)).toBe(true);
    } finally { t[RW.weaver_items].rows = kept; }
  });

  it('the draw fills the gain\'s Boon budget within the margin, as a kept vow\'s does', () => {
    const s = makeVillage();
    const t = getLibrary().rewardTables!, kept = t[RW.weaver_items].rows;
    try {
      t[RW.weaver_items].rows = [{ weight: 1, item: IT.healing_draught }]; // Boon 0.5 each; the Loop (Boon 20) is over these budgets: put back
      for (const gain of ['minor', 'moderate']) {
        const got = weaverRewards(s, gain, createRng(3));
        const boon = got.filter((r) => r.item === IT.healing_draught).reduce((n, r) => n + r.qty, 0) * 0.5;
        expect(boon).toBeGreaterThanOrEqual(CONFIG.BOON_BUDGET[gain] * (1 - CONFIG.VOW_REWARD_MARGIN));
        expect(boon).toBeLessThanOrEqual(CONFIG.BOON_BUDGET[gain] * (1 + CONFIG.VOW_REWARD_MARGIN));
      }
      expect(weaverRewards(s, 'none', createRng(3))).toEqual([]);
    } finally { t[RW.weaver_items].rows = kept; }
  });
});
