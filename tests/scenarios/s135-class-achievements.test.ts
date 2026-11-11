// 135 D-122 class and level achievements: classes at their top level in all, per class tier and across tiers, and
// an achievement every 10 character levels at reward level 0.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { achievementName, awardXp, charLevel } from '../../src/engine/xp';
import { achLevel, achXp, rewardName } from '../../src/ruleset/achRewards';
import { classMaxLevel } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const earned = (s: GameState) => (s.player.progression!.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.id);

describe('135 class and level achievements', () => {
  it('maxing classes counts in all, per tier and across tiers', () => {
    const s = makeVillage();
    const lib = getLibrary().classes;
    const ids = Object.keys(lib);
    s.player.core.classes = ids.map((id, i) => ({ classId: id, state: i ? 'previous' as const : 'current' as const, level: classMaxLevel(id) }));
    awardXp(s, 1, 'test');
    const tiers = new Map<string, number>();
    for (const id of ids) tiers.set(lib[id].tier, (tiers.get(lib[id].tier) ?? 0) + 1);
    const got = earned(s);
    expect(got).toContain(ids.length >= 10 ? ACH.class_max_10 : ids.length >= 5 ? ACH.class_max_5 : ids.length >= 3 ? ACH.class_max_3 : ACH.class_max_1);
    for (const [t, n] of tiers) {
      // one chain per tier: Peak (1) is replaced by Twin Peaks (2), then Crown (3)
      if (n === 1) expect(got).toContain(`${ACH.class_max_tier_1}:${t}`);
      if (n === 2) expect(got).toContain(`${ACH.class_max_tier_2}:${t}`);
      if (n >= 3) expect(got).toContain(`${ACH.class_max_tier_3}:${t}`);
    }
    const step = [ACH.class_tiers_2, ACH.class_tiers_3, ACH.class_tiers_4, ACH.class_tiers_5][Math.min(tiers.size, 5) - 2];
    if (step) expect(got).toContain(step);
    const peak = s.player.progression!.achievements!.find((a) => a.id === `${ACH.class_max_tier_1}:tier_1`);
    if (peak) expect(achievementName(s, peak)).toBe('Peak of the Trained');
  });
  it('the tiers chain steps one at a time from 2 up to every tier, which pays level VI', () => {
    const a = getLibrary().achievements!;
    const chain = [ACH.class_tiers_2, ACH.class_tiers_3, ACH.class_tiers_4, ACH.class_tiers_5, ACH.class_tiers_all];
    expect(chain.map((id) => a[id].count)).toEqual([2, 3, 4, 5, 6]);
    expect(chain.map((id) => a[id].level)).toEqual(['ii', 'iii', 'iv', 'v', 'vi']);
    expect(chain.slice(1).map((id) => a[id].after)).toEqual(chain.slice(0, -1));
    expect(CONFIG.REWARD_XP.vi).toBe(10000);
  });
  it('each 10 levels has a name of its own, and past 100 the row falls back to its template', () => {
    const s = makeVillage();
    const d = getLibrary().achievements![ACH.char_level_10];
    const names = Array.from({ length: 10 }, (_, i) => achievementName(s, { id: `${ACH.char_level_10}:${(i + 1) * 10}`, key: ACH.char_level_10, of: String((i + 1) * 10) }));
    expect(new Set(names).size).toBe(10);
    expect(names[9]).toBe(d.names![100]);
    expect(achievementName(s, { id: `${ACH.char_level_10}:110`, key: ACH.char_level_10, of: '110' })).toBe('Woven Past Counting (110)');
  });
  it('every 10 character levels pays an achievement, once per multiple, one reward level higher each time from −1', () => {
    const s = makeVillage();
    const cur = s.player.core.classes.find((c) => c.state === 'current')!;
    cur.level = 0;
    s.player.core.classes = [cur];
    const lvl = (n: number) => { cur.level = n; awardXp(s, 1, 'test'); };
    lvl(9);
    expect(earned(s).filter((x) => x.startsWith(`${ACH.char_level_10}:`))).toEqual([]);
    lvl(Math.min(classMaxLevel(cur.classId), 20));
    const lv = charLevel(s.player);
    const want = Array.from({ length: Math.floor(lv / 10) }, (_, i) => `${ACH.char_level_10}:${(i + 1) * 10}`);
    expect(earned(s).filter((x) => x.startsWith(`${ACH.char_level_10}:`))).toEqual(want);
    const d = getLibrary().achievements![ACH.char_level_10];
    expect([10, 20, 30, 40, 50, 60, 70, 80].map((n) => achLevel(d, String(n)))).toEqual(['minus_1', 'zero', 'i', 'ii', 'iii', 'iv', 'v', 'vi']);
    expect(achXp(d, '10')).toBe(CONFIG.REWARD_XP.minus_1);
    expect(achXp(d, '30')).toBe(CONFIG.REWARD_XP.i);
    // past VI the table goes on to XV, and stays there
    expect([90, 100, 150, 160, 300].map((n) => rewardName(achLevel(d, String(n))))).toEqual(['VII', 'VIII', 'XIII', 'XIV', 'XV']);
    expect(achXp(d, '90')).toBe(CONFIG.REWARD_XP.vii);
    expect(achXp(d, '300')).toBe(CONFIG.REWARD_XP.xv);
    if (want.length) expect(achievementName(s, s.player.progression!.achievements!.find((a) => a.id === want[0])!)).toBe('No Longer Green');
  });
});
