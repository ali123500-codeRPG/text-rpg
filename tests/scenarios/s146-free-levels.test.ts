// 146 free levels: level-ups that cost no XP, given by achievements and perks. The tiers chain (Across Two Heights up to
// Every Height Climbed) gives +1, +2, +3, +4, +5 by its place, each level including the lower ones (+3 in all at the second).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { charLevel, freeLevelsOwed, grantAchievement, spendXp } from '../../src/engine/xp';
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
});
