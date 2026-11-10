// 146 free levels: level-ups that cost no XP, given by achievements and perks; and bonus levels, character levels no class gets. The tiers chain (Across Two Heights up to
// Every Height Climbed) gives +1, +2, +3, +4, +5 by its place, each level including the lower ones (+3 in all at the second).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { bonusLevelsOwed, charLevel, freeLevelsOwed, grantAchievement, spendXp, xpToNext } from '../../src/engine/xp';
import { CONFIG } from '../../src/config';
import { freeLevelsEarned, rewardLines } from '../../src/ruleset/achRewards';
import { classMaxLevel } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { CL } from '../../src/library/classIds';

const chain = [ACH.class_tiers_2, ACH.class_tiers_3, ACH.class_tiers_4, ACH.class_tiers_5, ACH.class_tiers_all];

describe('146 free levels', () => {
  it('the tiers chain gives free levels by its place, carried up the chain', () => {
    const a = getLibrary().achievements!;
    expect(chain.map((id) => a[id].freeLevels)).toEqual([1, 2, 3, 4, 5]);
    expect(chain.map((id) => a[id].name)).toEqual(['Across Two Heights', 'Across Three Heights', 'Across Four Heights', 'Across Five Heights', 'Every Height Climbed']);
    expect(rewardLines(a[ACH.class_tiers_3])).toEqual(['+1 free level (levels that cost no XP) (from Across Two Heights)', '+2 free levels (levels that cost no XP)']);
  });

  it('a free level is taken at once like any level, without spending XP', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    const before = charLevel(p), log = pr.xpLog?.length ?? 0;
    grantAchievement(s, ACH.class_tiers_2);
    const ups = pr.xpLog!.slice(log).filter((x) => x.levelUp);
    expect(ups.filter((x) => x.source === 'free level').length).toBe(1);
    expect(charLevel(p)).toBe(before + ups.length); // XP levels (from the achievement's own XP) plus the free one
    grantAchievement(s, ACH.class_tiers_3);
    expect(freeLevelsEarned(p)).toBe(3); // the second level includes the first: +1 +2
    expect(pr.freeLevelsTaken).toBe(3);
    expect(pr.xpLog!.filter((x) => x.source === 'free level').length).toBe(3);
  });

  it('free levels do not raise the XP cost of the next level', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    pr.xp = 0;
    const cost = xpToNext(p), level = charLevel(p);
    pr.freeLevelsTaken = 0;
    p.core.classes.find((c) => c.state === 'current')!.level += 2;
    pr.freeLevelsTaken = 2; // two levels that came free
    expect(charLevel(p)).toBe(level + 2);
    expect(xpToNext(p)).toBe(cost);
    expect(cost).toBe(CONFIG.LEVEL_XP * Math.max(1, level));
  });

  it('free levels bank while no class has room, and arrive when a class is picked', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    const cur = p.core.classes.find((c) => c.state === 'current')!;
    cur.level = classMaxLevel(cur.classId);
    p.core.classes = [cur];
    pr.xp = 0;
    grantAchievement(s, ACH.class_tiers_2);
    expect(freeLevelsOwed(p)).toBe(1); // banked: the current class is at its top level
    const next = p.core.classes.find((c) => c.state === 'unlocked') ?? (p.core.classes.push({ classId: cur.classId === CL.trader ? CL.swordsman : CL.trader, state: 'unlocked', level: 0 }), p.core.classes.at(-1)!);
    pr.nextClass = next.classId;
    pr.xp = 0;
    spendXp(s);
    expect(freeLevelsOwed(p)).toBe(0);
    expect(next.level).toBe(1);
  });

  it('bonus levels add character levels no class gets: perk points on even levels, no class level, no dearer XP', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    pr.xp = 0;
    const row = getLibrary().achievements![ACH.clean_10];
    row.bonusLevels = 2; // a stand-in row for the test; no row gives bonus levels yet
    try {
      const level = charLevel(p), points = pr.unspentPerkPoints, log = pr.xpLog?.length ?? 0;
      const classLevels = () => p.core.classes.reduce((n, c) => n + c.level, 0), before = classLevels();
      expect(rewardLines(row)).toContain('+2 bonus levels (character levels no class gets: perk points, no class perks)');
      grantAchievement(s, ACH.clean_10);
      const ups = pr.xpLog!.slice(log).filter((x) => x.levelUp);
      const xpLevels = ups.filter((x) => x.source === 'level').length; // the achievement's own 100 XP may buy a level too
      expect(ups.filter((x) => x.source === 'bonus level').map((x) => x.levelUp!.classId)).toEqual(['', '']);
      expect(bonusLevelsOwed(p)).toBe(0);
      expect(pr.bonusLevelsTaken).toBe(2);
      expect(charLevel(p)).toBe(level + 2 + xpLevels);
      expect(classLevels()).toBe(before + xpLevels); // no class got the bonus levels
      expect(pr.unspentPerkPoints).toBe(points + ups.filter((x) => x.levelUp!.level % 2 === 0).length); // a point on each even level
      expect(xpToNext(p)).toBe(CONFIG.LEVEL_XP * Math.max(1, charLevel(p) - 2)); // bonus levels don't make the next level dearer
    } finally { delete row.bonusLevels; }
  });
});
