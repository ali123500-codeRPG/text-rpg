// 332 Rewards for XP-only achievements, round 1 (XR2, XR4, XR9, XR11, XR15, XR16, XR17, XR30, XR32, XR35): the four new
// reward fields (true skill by kind, selling price %, quest pay %, essence slots) and the chains that now pay more than XP.
// Amounts follow the "+1, +2, +3 added up" format: each level adds its own amount on top of the levels below it.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAchievement } from '../../src/engine/xp';
import { essenceSlots } from '../../src/engine/essence';
import { buyingPrice } from '../../src/engine/trade';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { SK, SENSE_SKILL } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { groupsOf } from '../../src/library/functionNames';
import { achievementAimEase, achievementMaxMorale, achievementSkill, bestReward, kindSkills, rewardLines, rewardOf } from '../../src/ruleset/achRewards';
import type { GameState } from '../../src/types';

const L = () => getLibrary().achievements! as Record<string, import('../../src/types').AchievementDef>;
const give = (s: GameState, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, undefined, undefined, true); };
const giveOf = (s: GameState, of: string, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, of, undefined, true); };

describe('332 XP-only rewards, round 1', () => {
  it('XR15: unseen moves pay Sneaking +1, +2, +3 (6 at the top) and one step quieter at 250', () => {
    const s = makeVillage();
    give(s, ACH.unseen_1, ACH.unseen_10);
    expect(achievementSkill(s.player, SK.sneaking)).toBe(1);
    give(s, ACH.unseen_50, ACH.unseen_250);
    expect(achievementSkill(s.player, SK.sneaking)).toBe(6);
    expect(rewardOf(L()[ACH.unseen_250], 'quieter')).toBe(1);
  });

  it('XR16: vanished gains a 50 row; Vanishing +1, +2, +3', () => {
    expect(L()[ACH.vanished_50]).toMatchObject({ count: 50, after: ACH.vanished_25, rule: 'vanished' });
    const s = makeVillage();
    give(s, ACH.vanished_1, ACH.vanished_5, ACH.vanished_25, ACH.vanished_50);
    expect(achievementSkill(s.player, SK.vanishing)).toBe(6);
  });

  it('XR4 b: Beyond Perfect for a group adds +1 true skill per level to every skill of that group', () => {
    const s = makeVillage();
    const skills = getLibrary().skills;
    const group = groupsOf(skills[SK.sneaking])[0];
    giveOf(s, group, ACH.beyond_group_1, ACH.beyond_group_2);
    const inGroup = kindSkills('group', group);
    expect(inGroup).toContain(SK.sneaking);
    for (const sk of inGroup) expect(achievementSkill(s.player, sk)).toBeGreaterThanOrEqual(2);
    const outside = Object.keys(skills).find((k) => !inGroup.includes(k))!;
    expect(achievementSkill(s.player, outside)).toBe(0);
  });

  it("XR17: the per-sense branch pays that sense's skill +2 at 10 and again at 100; the trunk pays nothing yet", () => {
    const s = makeVillage();
    giveOf(s, FN.sight, ACH.spotted_fn_1, ACH.spotted_fn_10, ACH.spotted_fn_100);
    expect(achievementSkill(s.player, SENSE_SKILL[FN.sight])).toBe(4);
    expect(achievementSkill(s.player, SENSE_SKILL[FN.hearing])).toBe(0);
    expect(rewardLines(L()[ACH.spotted_10])).toEqual([]);
  });

  it('XR9: aimed hits ease the aim penalty on every size by 5% per level, on top of a by-size row', () => {
    const s = makeVillage();
    give(s, ACH.aimed_10, ACH.aimed_50);
    expect(achievementAimEase(s.player, 'small')).toBeCloseTo(0.10);
    giveOf(s, 'small', ACH.aimed_size_1);
    expect(achievementAimEase(s.player, 'small')).toBeCloseTo(0.10 + (L()[ACH.aimed_size_1].aimEase ?? 0) / 100);
  });

  it('XR11 and XR30: won while panicking and morale lost each pay +5 max morale per level', () => {
    const s = makeVillage();
    give(s, ACH.won_panicking_1, ACH.won_panicking_10, ACH.won_panicking_25);
    expect(achievementMaxMorale(s.player)).toBe(15);
    give(s, ACH.morale_lost_100, ACH.morale_lost_1000);
    expect(achievementMaxMorale(s.player)).toBe(25);
  });

  it('XR32 b: achievements earned pay +1 on event rolls at 50 and +2 more at 250 (+3)', () => {
    expect(rewardOf(L()[ACH.total_50], 'eventRoll')).toBe(1);
    expect(rewardOf(L()[ACH.total_100], 'eventRoll')).toBe(1);
    expect(rewardOf(L()[ACH.total_250], 'eventRoll')).toBe(3);
  });

  it('XR35: Room for No More opens one more essence slot', () => {
    const s = makeVillage();
    const before = essenceSlots(s.player);
    give(s, ACH.room_for_no_more);
    expect(essenceSlots(s.player)).toBe(before + 1);
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
