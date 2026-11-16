// 340 Any Road Will Do (UL1, UL2): Unwritten Legend's own level 1 perk. Every function's stand-in share rises by
// UL_STAND_IN_ADD (0.3 becomes 0.5), kept within 0 to 1; Quick Study stays A Nobody's level 1 perk only.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { standInTable } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { PK } from '../../src/library/perkIds';

describe('340 Any Road Will Do', () => {
  it('is the Legend\'s level 1 perk; Quick Study is A Nobody\'s alone', () => {
    const lib = getLibrary();
    expect(lib.classes[CL.late_bloomer].levelPerks).toEqual({ 1: [PK.any_road_will_do] });
    expect(lib.perks[PK.any_road_will_do].classLevel).toEqual({ classId: CL.late_bloomer, level: 1 });
    const withQuickStudy = Object.values(lib.classes).filter((c) => Object.values(c.levelPerks ?? {}).flat().includes(PK.quick_study)).map((c) => c.id);
    expect(withQuickStudy).toEqual([CL.a_nobody]);
    expect(lib.perks[PK.quick_study].classLevel).toEqual({ classId: CL.a_nobody, level: 1 });
  });

  it('raises every function\'s stand-in share by UL_STAND_IN_ADD, up to 1', () => {
    expect([CONFIG.SUBSTITUTE_EFFICIENCY, CONFIG.UL_STAND_IN_ADD]).toEqual([0.3, 0.2]);
    const p = makeVillage().player;
    p.core.perks = [];
    for (const skill of [SK.dodge, SK.melee_medium, SK.intimidation]) {
      const before = standInTable(skill, p);
      expect(before.length, skill).toBeGreaterThan(0);
      p.core.perks = [{ perkId: PK.any_road_will_do, source: 'class', gainedTurn: 0 }];
      const after = standInTable(skill, p);
      p.core.perks = [];
      expect(after.map((t) => t.fn)).toEqual(before.map((t) => t.fn));
      after.forEach((t, i) => expect(t.k, `${skill} ${t.fn}`).toBeCloseTo(Math.min(1, before[i].k + CONFIG.UL_STAND_IN_ADD)));
      if (before.some((t) => t.k === CONFIG.SUBSTITUTE_EFFICIENCY)) expect(after.some((t) => Math.abs(t.k - 0.5) < 1e-9), skill).toBe(true);
    }
  });
});
