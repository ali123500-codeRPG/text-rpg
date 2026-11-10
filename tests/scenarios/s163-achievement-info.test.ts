// 163 What the play screen shows for an earned achievement: reward level, XP, what it asks for, and why it was earned.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { achievementInfo, tally } from '../../src/engine/xp';
import { ACH, ACH_RULE_ONE, ACH_RULE_TEXT } from '../../src/library/achievementIds';
import { getLibrary } from '../../src/library';
import { HL } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const got = (s: GameState, key: string) => s.player.progression!.achievements!.find((a) => a.key === key)!;

describe('163 achievement info', () => {
  it('a count achievement says what it asks for, its level and XP, and when you reached it', () => {
    const s = makeVillage();
    s.turn = 7;
    for (let i = 0; i < 10; i++) tally(s, 'won_panicking');
    const info = achievementInfo(s, got(s, ACH.won_panicking_10));
    expect(info).toMatchObject({ name: 'Fear Rides With Me', level: 'ii', levelName: 'II', xp: CONFIG.REWARD_XP.ii, scar: false });
    expect(info.earnedAt).toBe('10 fights won while your morale is Panicking');
    expect(info.why).toBe('Turn 7: you reached 10 fights won while your morale is Panicking.');
  });
  it('a high-water mark keeps the value reached; a source-pinned row names its source; an every-N row names its level', () => {
    const s = makeVillage();
    tally(s, 'won_above', { to: 137 });
    expect(achievementInfo(s, got(s, ACH.won_above_100)).why).toContain('you reached 137;');
    tally(s, 'healed', { by: 'heal_source', of: HL.rest, add: 100 });
    expect(achievementInfo(s, got(s, ACH.healed_rest_100)).earnedAt).toBe('100 HP healed from Rest');
    tally(s, 'char_level', { to: 20 });
    const lv20 = s.player.progression!.achievements!.find((a) => a.id === `${ACH.char_level_10}:20`)!;
    expect(achievementInfo(s, lv20)).toMatchObject({ name: 'Steady Hand', levelName: '0', earnedAt: '20 character levels' });
  });
  it('a count of 1 reads in the singular', () => {
    const s = makeVillage();
    s.turn = 5;
    tally(s, 'crippled_defeats');
    tally(s, 'spar_losses');
    const crip = Object.entries(getLibrary().achievements!).find(([, d]) => d.rule === 'crippled_defeats' && d.count === 1)![0];
    const spar = Object.entries(getLibrary().achievements!).find(([, d]) => d.rule === 'spar_losses' && d.count === 1)![0];
    expect(achievementInfo(s, got(s, crip)).why).toBe('Turn 5: you reached 1 foe defeated while one of your parts is Crippled.');
    expect(achievementInfo(s, got(s, spar)).earnedAt).toBe('1 spar lost');
  });
  it('every plural rule text has a singular form', () => {
    for (const [rule, text] of Object.entries(ACH_RULE_TEXT)) {
      if (/^(copper|HP|morale|points|%|true skill|class unlocked)/.test(text)) continue;
      expect(ACH_RULE_ONE[rule as keyof typeof ACH_RULE_ONE], rule).toBeTruthy();
    }
  });
  it('a scar says it is one and pays one level lower', () => {
    const s = makeVillage();
    tally(s, 'morale_breaks');
    expect(achievementInfo(s, got(s, ACH.morale_breaks_1))).toMatchObject({ scar: true, levelName: '0', xp: CONFIG.REWARD_XP.minus_1 });
  });
});
