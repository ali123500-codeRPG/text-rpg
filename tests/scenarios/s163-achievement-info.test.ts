// 163 What the play screen shows for an earned achievement: reward level, XP, what it asks for, and why it was earned.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { achievementInfo, tally } from '../../src/engine/xp';
import { ACH } from '../../src/library/achievementIds';
import { HL } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const got = (s: GameState, key: string) => s.player.progression!.achievements!.find((a) => a.key === key)!;

describe('163 achievement info', () => {
  it('a count achievement says what it asks for, its level and XP, and the count you reached', () => {
    const s = makeVillage();
    s.turn = 7;
    for (let i = 0; i < 10; i++) tally(s, 'won_panicking');
    const info = achievementInfo(s, got(s, ACH.won_panicking_10));
    expect(info).toMatchObject({ name: 'Fear Rides With Me', level: 'ii', levelName: 'II', xp: CONFIG.REWARD_XP.ii, scar: false });
    expect(info.earnedAt).toBe('10 fights won while your morale is Panicking');
    expect(info.why).toBe('Turn 7: you reached 10; this needs 10 fights won while your morale is Panicking.');
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
  it('a scar says it is one and pays one level lower', () => {
    const s = makeVillage();
    tally(s, 'morale_breaks');
    expect(achievementInfo(s, got(s, ACH.morale_breaks_1))).toMatchObject({ scar: true, levelName: '0', xp: CONFIG.REWARD_XP.minus_1 });
  });
});
