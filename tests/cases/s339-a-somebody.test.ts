// 339 A Somebody (CB1-CB7): a Renowned (tier 3) class between A Nobody and Unwritten Legend. It opens when A Nobody
// reaches its top level, with no skill road (CB7); its level 1 perk Late Bloom gives the double improvement roll to any
// skill below LATE_BLOOM_SHARE of the owner's highest raw skill (CB5); reaching its own top level opens Unwritten
// Legend in play (CB3). Its capstone is parked (ICI-360).
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { unlockClasses } from '../../src/engine/xp';
import { improveMarked } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { PK } from '../../src/library/perkIds';

describe('339 A Somebody', () => {
  it('opens at A Nobody 15, and Unwritten Legend opens at A Somebody 20', () => {
    const s = makeVillage(), p = s.player;
    p.core.classes = [{ classId: CL.a_nobody, state: 'current', level: 14 }];
    unlockClasses(s);
    expect(p.core.classes.some((c) => c.classId === CL.a_somebody)).toBe(false);
    p.core.classes[0].level = 15;
    unlockClasses(s);
    expect(p.core.classes).toContainEqual({ classId: CL.a_somebody, state: 'unlocked', level: 0 });
    expect(p.core.classes.some((c) => c.classId === CL.late_bloomer)).toBe(false);
    p.core.classes[1] = { classId: CL.a_somebody, state: 'current', level: 20 };
    unlockClasses(s);
    expect(p.core.classes).toContainEqual({ classId: CL.late_bloomer, state: 'unlocked', level: 0 });
  });

  it('Late Bloom: a skill below half the highest raw skill gets two improvement rolls', () => {
    const s = makeVillage(), p = s.player; // Medium Weapons 50 is the highest raw skill, so the line is 25
    p.core.perks = [{ perkId: PK.late_bloom, source: 'class', gainedTurn: 0 }];
    p.progression!.marks = [SK.intimidation, SK.dodge]; // 15 is below 25; 25 is not
    const gains = improveMarked(s, forcedRng([90, 90, 90, 90]));
    expect(gains.filter((g) => g.skill === SK.intimidation)).toHaveLength(2);
    expect(gains.filter((g) => g.skill === SK.dodge)).toHaveLength(1);
  });
});
