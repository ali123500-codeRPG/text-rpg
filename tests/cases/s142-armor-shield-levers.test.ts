// QE2: a minted weapon's damage boost is QUALITY_DAMAGE_FACTOR × need × quality × class factor × tree factor.
// QE4–QE6: armor stops ARMOR_FACTOR × its need (the multiplier stays with its weight), a shield's pool is
// POOL_BASE + POOL_FACTOR × its need, and a minted piece's quality adds factor × need × quality to either.
import { describe, expect, it } from 'vitest';
import { IT } from '../../src/library/itemIds';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { makeVillage } from '../harness';
import { mint } from '../../src/scenario/apply';
import { itemDef } from '../../src/library';

const minted = (base: string, quality: 1 | 2 | 3 | 4, boosts: 'hitAdj' | 'damageAdj' = 'hitAdj') => {
  const s = makeVillage();
  return itemDef(s, mint(s, { base, quality: (['quality_1', 'quality_2', 'quality_3', 'quality_4'] as const)[quality - 1], boosts, name: 'a find', look: 'a find' }, 1));
};

describe('142 armor and shield levers', () => {
  it('library armor keeps today\'s numbers: gambeson 2, mail 4, plate 6; the round shield pool is 40', () => {
    const I = getLibrary().items;
    expect([IT.gambeson, IT.mail_hauberk, IT.plate_harness].map((id) => I[id].armor!.reduction)).toEqual([2, 4, 6]);
    expect([IT.gambeson, IT.mail_hauberk, IT.plate_harness].map((id) => I[id].armor!.multiplier)).toEqual([0.8, 0.65, 0.55]);
    expect(I[IT.round_shield].shield!.pool).toBe(CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * CONFIG.EQUIP_NEED.common);
  });

  it('minted mail: quality 1 and 2 stay Fine (need 50) and add 1; quality 4 moves to Superior (need 75) and adds 3', () => {
    expect(minted(IT.mail_hauberk, 1).armor!.reduction).toBe(4 + 1);
    expect(minted(IT.mail_hauberk, 2).armor!.reduction).toBe(4 + 1);
    expect(minted(IT.mail_hauberk, 4).armor!.reduction).toBe(6 + 3);
  });

  it('a minted round shield: quality 2 adds 5 to a Common pool; quality 3 moves to Fine (60) and adds 15', () => {
    expect(minted(IT.round_shield, 2).shield!.pool).toBe(40 + 5);
    expect(minted(IT.round_shield, 3).shield!.pool).toBe(60 + 15);
  });

  it('QE2: damage boosts scale with need, the mode class and melee or ranged', () => {
    expect(minted(IT.arming_sword, 1, 'damageAdj').weapon!.modes[0].damageAdj).toBe(1); // 0.02 × 50 × 1 × medium 1
    expect(minted(IT.arming_sword, 4, 'damageAdj').weapon!.modes[0].damageAdj).toBe(6); // Superior 75 × 4
    expect(minted(IT.dagger, 2, 'damageAdj').weapon!.modes[0].damageAdj).toBeCloseTo(0.8); // Common 25 × 2 × light 0.8
    expect(minted(IT.greataxe, 1, 'damageAdj').weapon!.modes[0].damageAdj).toBeCloseTo(1.8); // Superior 75 × 1 × heavy 1.2
  });
});
