// 135 D-122 class and level achievements: classes at their top level in all, per class tier and across tiers, and
// an achievement every 10 character levels at reward level 0.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { achievementName, awardXp, charLevel } from '../../src/engine/xp';
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
      expect(got).toContain(`${ACH.class_max_tier_1}:${t}`);
      if (n === 2) expect(got).toContain(`${ACH.class_max_tier_2}:${t}`);
      if (n >= 3) expect(got).toContain(`${ACH.class_max_tier_3}:${t}`);
    }
    if (tiers.size >= 4) expect(got).toContain(ACH.class_tiers_4);
    else if (tiers.size >= 2) expect(got).toContain(ACH.class_tiers_2);
    const peak = s.player.progression!.achievements!.find((a) => a.id === `${ACH.class_max_tier_1}:tier_1`);
    if (peak) expect(achievementName(s, peak)).toBe('Peak of Tier 1');
  });
  it('every 10 character levels pays a level 0 achievement, once per multiple', () => {
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
    expect(CONFIG.REWARD_XP[getLibrary().achievements![ACH.char_level_10].level]).toBe(50);
    if (want.length) expect(achievementName(s, s.player.progression!.achievements!.find((a) => a.id === want[0])!)).toBe('Risen to Level 10');
  });
});
