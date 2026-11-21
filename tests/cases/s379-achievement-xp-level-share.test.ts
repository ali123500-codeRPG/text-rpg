// AL1-AL8: achievement, scar and quest XP add a share of the earner's XP to the next level, inside the one reward-XP equation
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { achievementInfo, tally, xpToNext } from '../../src/engine/xp';
import { ACH } from '../../src/library/achievementIds';
import { getLibrary } from '../../src/library';
import { achXp, rewardXp, rewardXpAt } from '../../src/ruleset/achRewards';

const share = (p: number) => (rewardXpAt(p, 10000) - rewardXpAt(p)) / 10000;

describe('379 achievement XP level share', () => {
  it('AL8: level I adds 2% of a level, VI about 30%; level 0, −1 and the scar below −1 get the 0.5% floor; weaker than squared', () => {
    expect(share(1)).toBeCloseTo(0.02, 4);
    expect(share(6)).toBeGreaterThan(0.25);
    expect(share(6)).toBeLessThan(0.4);
    for (const p of [0, -1, -2]) expect(share(p)).toBeCloseTo(0.005, 4);
    expect(share(2) / share(1)).toBeLessThan(4); // doubling the place less than quadruples the share
    expect(share(15)).toBeGreaterThan(share(10)); // no top past X
    expect(rewardXp('i')).toBe(169); // need 0: the fixed ladder as before
  });

  it('AL3: an earned achievement pays the fixed part plus the share of the XP to the next level at that moment', () => {
    const s = makeVillage();
    const need = xpToNext(s.player);
    for (let i = 0; i < 10; i++) tally(s, 'won_panicking');
    const got = s.player.progression!.achievements!.find((a) => a.key === ACH.won_panicking_10)!;
    const paid = s.player.progression!.xpLog!.find((x) => x.source === `achievement:${got.id}`)!.amount;
    expect(paid).toBe(achXp(getLibrary().achievements![ACH.won_panicking_10], undefined, need));
    expect(paid).toBeGreaterThan(rewardXp('ii'));
    expect(achievementInfo(s, got).xp).toBe(paid); // the pop-up shows what was paid
  });

  it('a scar pays the place below its row with its share; the scar under level −1 pays only the floor share', () => {
    const scar = { level: 'minus_1', scar: true as const };
    expect(achXp(scar)).toBe(0);
    expect(achXp(scar, undefined, 1000)).toBe(5);
  });

});
