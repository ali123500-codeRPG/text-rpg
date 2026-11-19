// 338 Rewards for XP-only achievements, round 3 (XR20 + XR38 b, XR29 + XR39 a): talked down adds +2 true Persuasion per
// level (+6 at 50); health lost moves the "your health reaches a new level" fear one health level later per level from
// level II (Wounded at 1,000%, Mauled at 10,000%); the Critical fear stays.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAchievement } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { FR } from '../../src/library/tableIds';
import { achievementSkill, rewardLines } from '../../src/ruleset/achRewards';
import { healthFear } from '../../src/ruleset/morale';
import type { AchievementDef, GameState } from '../../src/types';

const L = () => getLibrary().achievements! as Record<string, AchievementDef>;
const give = (s: GameState, ...keys: string[]) => { for (const k of keys) grantAchievement(s, k, undefined, undefined, true); };
const fearAt = (s: GameState, l: Parameters<typeof healthFear>[1]) => healthFear(s.player, l)?.id;

describe('338 XP-only rewards, round 3', () => {
  it('XR38 b: talked down adds +2 true Persuasion per level, whatever skill was used', () => {
    const s = makeVillage();
    give(s, ACH.talked_down_1);
    expect(achievementSkill(s.player, SK.persuasion)).toBe(2);
    give(s, ACH.talked_down_10, ACH.talked_down_50);
    expect(achievementSkill(s.player, SK.persuasion)).toBe(6);
    expect(achievementSkill(s.player, SK.falsehood)).toBe(0);
  });

  it('XR39 a: health lost moves only the new-level fear, one level later per level from level II', () => {
    const s = makeVillage();
    expect([fearAt(s, 'injured'), fearAt(s, 'wounded'), fearAt(s, 'critical')]).toEqual([FR.own_level, FR.own_level, FR.own_critical]);
    give(s, ACH.hp_lost_100);
    expect(fearAt(s, 'injured')).toBe(FR.own_level); // level I: no change
    give(s, ACH.hp_lost_1000);
    expect([fearAt(s, 'injured'), fearAt(s, 'wounded')]).toEqual([undefined, FR.own_level]);
    give(s, ACH.hp_lost_10000); // carries level II's step up the chain
    expect([fearAt(s, 'wounded'), fearAt(s, 'mauled'), fearAt(s, 'critical')]).toEqual([undefined, FR.own_level, FR.own_critical]);
    expect(rewardLines(L()[ACH.hp_lost_10000])).toHaveLength(2);
  });
});
