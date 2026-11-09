// 131 Class level cap: a class's top level is set by its tier (tier 0 → 5, +5 a tier, at most CLASS_MAX_LEVEL 20).
// XP past it banks until a class with room is picked, then every banked level is taken at once. The default class
// (Commoner, tier 0) opens at the top level; its capstone at 5 unlocks A Nobody, a starting class with Quick Study at
// level 1 and the capstone Every Fall a Lesson at its top level (15, tier 2). Capstones come at the top level.
import { RC } from '../../src/library/raceIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { awardXp, charLevel, keepCapstone, levelTarget, spendXp, swapCapstone, xpToNext } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { classMaxLevel, createPlayer, recommendedBuild } from '../../src/library/spawn';
import { CONFIG } from '../../src/config';
import { CL } from '../../src/library/classIds';
import { CLASS_TIERS } from '../../src/scales';
import { SK } from '../../src/library/skillIds';
import { markUse } from '../../src/ruleset/improve';
import type { ContestResult } from '../../src/types';
import { PK } from '../../src/library/perkIds';

describe('131 Class level cap', () => {
  it('XP banks at the cap, the default class opens, and picking it takes every banked level', () => {
    const s = makeVillage();
    const p = s.player, pr = p.progression!;
    expect(CONFIG.CLASS_MAX_LEVEL).toBe(20);
    expect(getLibrary().classes[CL.commoner].name).toBe('Commoner');
    p.core.classes = [{ classId: CL.swordsman, state: 'current', level: 9 }];
    p.core.perks = [];
    awardXp(s, xpToNext(p), 'test'); // 9 → 10, the Swordsman's top level (tier 1)
    expect(p.core.classes[0].level).toBe(10);
    expect(levelTarget(p)).toBeUndefined();
    expect(p.core.classes).toContainEqual({ classId: CL.commoner, state: 'unlocked', level: 0 });
    const before = pr.xp; // XP from the class achievements reached at the top level
    const banked = CONFIG.LEVEL_XP * (10 + 11 + 12);
    awardXp(s, banked + 5, 'test');
    expect(charLevel(p)).toBe(10); // banked, no level
    expect(pr.xp).toBe(before + banked + 5);
    pr.nextClass = CL.commoner; // the sheet's picker
    spendXp(s);
    expect(p.core.classes.map((c) => [c.classId, c.state, c.level])).toEqual([[CL.swordsman, 'previous', 10], [CL.commoner, 'current', 3]]);
    expect(pr.xp).toBe(before + 5);
    expect(p.core.perks.filter((x) => x.source === 'class')).toEqual([]);
    p.core.classes[1].level = 4;
    awardXp(s, xpToNext(p), 'test'); // Commoner 4 → 5, its top level: the capstone Nobody Special unlocks A Nobody
    expect(p.core.perks.map((x) => x.perkId)).toContain(PK.nobody_special);
    expect(p.core.classes).toContainEqual({ classId: CL.a_nobody, state: 'unlocked', level: 0 });
    expect(levelTarget(p)).toBeUndefined(); // Commoner is at its top level too: XP banks until A Nobody is picked
  });

  it('a class\'s top level comes from its tier, and the capstone comes at it', () => {
    expect([CL.commoner, CL.swordsman, CL.sword_dancer, CL.a_nobody, CL.late_bloomer].map(classMaxLevel)).toEqual([5, 10, 10, 15, 20]);
    const lib = getLibrary();
    for (const c of Object.values(lib.classes)) for (const id of c.capstone ?? []) expect(lib.perks[id]?.classLevel, id).toEqual({ classId: c.id, level: classMaxLevel(c.id) });
  });

  it('A Nobody: a starting class with Quick Study at level 1', () => {
    const p = createPlayer(recommendedBuild(CL.a_nobody), 's1');
    expect(getLibrary().classes[CL.a_nobody].name).toBe('A Nobody');
    expect(p.core.classes).toEqual([{ classId: CL.a_nobody, state: 'current', level: 1 }]);
    expect(p.core.perks.map((x) => x.perkId)).toEqual([PK.quick_study]);
    expect(getLibrary().classes[CL.a_nobody].capstone).toEqual([PK.every_fall_a_lesson]);
  });

  it('Every Fall a Lesson: losing by exactly one tier step marks, even outside the window', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills[SK.dodge] = { raw: 0, state: 'normal' };
    const lost = (gap: number) => {
      p.progression!.marks = [];
      const r = { a: { actorId: 'guard_1', skill: SK.melee_medium }, b: { actorId: 'player', skill: SK.dodge }, gap, winner: gap < 0 ? 'a' : 'b' };
      markUse(s, p, SK.dodge, r as unknown as ContestResult);
      return p.progression!.marks!.includes(SK.dodge);
    };
    expect(lost(-1)).toBe(false); // the guard is far outside Dodge 0's window
    p.core.perks.push({ perkId: PK.every_fall_a_lesson, source: 'class', gainedTurn: 0 });
    expect([lost(-1), lost(-2), lost(1)]).toEqual([true, false, false]); // one step short marks; two short or a win don't
  });

  it('alternate capstones: offered at the top level when their conditions hold, swapped in once for the default', () => {
    const reach20 = (dodge: number) => {
      const s = makeVillage(), p = s.player; // makeVillage resets the library, so the test capstones go in after it
      const cls = getLibrary().classes[CL.swordsman];
      cls.capstone = [PK.quick_study]; // stand-in perks: the real capstones are still being designed
      cls.capstones = [{ perk: PK.every_fall_a_lesson, needs: { must: [{ kind: 'skill', id: SK.dodge, level: 40 }] } },
        { perk: PK.nobody_special, needs: { must: [{ kind: 'race', id: RC.dragon }] } }];
      p.core.skills[SK.dodge] = { raw: dodge, state: 'normal' };
      p.core.perks = [];
      p.core.classes = [{ classId: CL.swordsman, state: 'current', level: 9 }];
      awardXp(s, xpToNext(p), 'test');
      return { s, p };
    };
    expect(reach20(10).p.progression!.capstoneOptions).toBeUndefined(); // Dodge 10: nothing on offer
    const { s, p } = reach20(40);
    expect(p.progression!.capstoneOptions).toEqual({ [CL.swordsman]: [PK.every_fall_a_lesson] }); // the dragon one isn't met
    expect(p.core.perks).toEqual([expect.objectContaining({ perkId: PK.quick_study, dormant: true })]); // the default waits, inactive
    expect(swapCapstone(p, CL.swordsman, PK.nobody_special, s.turn)).toBe(false);
    expect(swapCapstone(p, CL.swordsman, PK.every_fall_a_lesson, s.turn)).toBe(true);
    expect(p.core.perks.map((x) => x.perkId)).toEqual([PK.every_fall_a_lesson]);
    expect(swapCapstone(p, CL.swordsman, PK.every_fall_a_lesson, s.turn)).toBe(false); // once
    const kept = reach20(40);
    expect(keepCapstone(kept.p, CL.swordsman)).toBe(true); // keeping the default makes it active and closes the offer
    expect(kept.p.core.perks).toEqual([{ perkId: PK.quick_study, source: 'class', gainedTurn: kept.s.turn }]);
    expect(kept.p.progression!.capstoneOptions).toEqual({});
    expect(swapCapstone(kept.p, CL.swordsman, PK.every_fall_a_lesson, kept.s.turn)).toBe(false);
    expect(reach20(10).p.core.perks[0].dormant).toBeUndefined(); // nothing on offer: active at once
    makeVillage(); // restore the library
  });

  it('every class has a tier from the CLASS_TIERS table', () => {
    const lib = getLibrary();
    for (const c of Object.values(lib.classes)) expect(CLASS_TIERS.has(c.tier), c.name).toBe(true);
    const tier = (id: string) => CLASS_TIERS.pos(lib.classes[id].tier);
    expect([CL.commoner, CL.swordsman, CL.sword_dancer, CL.a_nobody, CL.late_bloomer].map(tier)).toEqual([0, 1, 1, 2, 5]);
  });
});
