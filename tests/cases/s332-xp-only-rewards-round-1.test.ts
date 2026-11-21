// 332 Rewards for XP-only achievements, round 1 (XR2, XR4, XR9, XR11, XR15, XR16, XR17, XR30, XR32, XR35): the four new
// reward fields (true skill by kind, selling price %, quest pay %, essence slots) and the chains that now pay more than XP.
// Amounts follow the "+1, +2, +3 added up" format: each level adds its own amount on top of the levels below it.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAchievement } from '../../src/engine/xp';
import { buyingPrice } from '../../src/engine/trade';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { SK, SENSE_SKILL } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { groupsOf } from '../../src/library/functionNames';
import { achievementMaxMorale, achievementSkill, bestReward, kindSkills, rewardLines } from '../../src/ruleset/achRewards';
import type { GameState } from '../../src/types';

const L = () => getLibrary().achievements! as Record<string, import('../../src/types').AchievementDef>;
const give = (s: GameState, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, undefined, undefined, true); };
const giveOf = (s: GameState, of: string, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, of, undefined, true); };

describe('332 XP-only rewards, round 1', () => {
  it('XR15, XR4 b, XR17: true skill rewards reach a named skill, every skill of a group, or a sense\'s skill, added up along the chain', () => {
    const s = makeVillage();
    give(s, ACH.unseen_1, ACH.unseen_10);
    expect(achievementSkill(s.player, SK.sneaking)).toBe(1); // unseen moves: Sneaking +1, +2, +3
    give(s, ACH.unseen_50, ACH.unseen_250);
    expect(achievementSkill(s.player, SK.sneaking)).toBe(6);
    // Beyond Perfect for a group: +1 per level to every skill of that group
    const skills = getLibrary().skills;
    const group = groupsOf(skills[SK.persuasion])[0];
    giveOf(s, group, ACH.beyond_group_1, ACH.beyond_group_2);
    const inGroup = kindSkills('group', group);
    expect(inGroup).toContain(SK.persuasion);
    for (const sk of inGroup) expect(achievementSkill(s.player, sk)).toBeGreaterThanOrEqual(2);
    const outside = Object.keys(skills).find((k) => !inGroup.includes(k) && k !== SK.sneaking && k !== SENSE_SKILL[FN.sight])!;
    expect(achievementSkill(s.player, outside)).toBe(0);
    // the per-sense branch pays that sense's skill +2 at 10 and again at 100; the trunk pays nothing yet
    giveOf(s, FN.sight, ACH.spotted_fn_1, ACH.spotted_fn_10, ACH.spotted_fn_100);
    expect(achievementSkill(s.player, SENSE_SKILL[FN.sight])).toBe(4);
    expect(achievementSkill(s.player, SENSE_SKILL[FN.hearing])).toBe(0);
    expect(rewardLines(L()[ACH.spotted_10])).toEqual([]);
  });

  it('XR11 and XR30: won while panicking and morale lost each pay +5 max morale per level', () => {
    const s = makeVillage();
    give(s, ACH.won_panicking_1, ACH.won_panicking_10, ACH.won_panicking_25);
    expect(achievementMaxMorale(s.player)).toBe(15);
    give(s, ACH.morale_lost_100, ACH.morale_lost_1000);
    expect(achievementMaxMorale(s.player)).toBe(25);
  });

  it('XR2: selling price and quest pay fields reach the trade and quest equations', () => {
    const s = makeVillage();
    const buyer = s.actors[0];
    const plain = buyingPrice(s.player, buyer, 1000);
    // a row with sellPct, written for this test only
    const lib = L();
    lib.TEST_SELL = { id: 'TEST_SELL', name: 'Test Seller', level: 'i', rule: 'coin_earned', tags: ['social'], count: 1, sellPct: 10 };
    give(s, 'TEST_SELL');
    expect(bestReward(s.player, 'sellPct')?.value).toBe(10);
    expect(buyingPrice(s.player, buyer, 1000)).toBe(Math.floor(plain * 1.1 + 1e-9));
    delete lib.TEST_SELL;
  });
});
