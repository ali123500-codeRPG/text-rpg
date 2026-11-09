// 128 Starting classes and class-level perks (Ali, 09/11/2026): Swordsman floors are Medium Weapons 40 and Block 40, which
// also unlock the class; the late bloomer starts as an Unwritten Legend with 50 points at level 1 and the class's level 1
// perk Quick Study (two improvement rolls for a skill below 15). Classes can grant perks at any level.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { awardXp, unlockClasses } from '../../src/engine/xp';
import { improveMarked } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';

describe('128 Late bloomer and class-level perks', () => {
  it('the late bloomer: 50 points, no floors, level 1, Quick Study, no Swordsman tree', () => {
    const b = recommendedBuild('late_bloomer');
    expect(validateBuild(b)).toEqual([]);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.dodge]: 10 } })).toEqual(['Spend exactly 50 points (55 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.feint]: 5, [SK.dodge]: 0 } })).toEqual(['Feint is not open to the point-buy']);
    const p = createPlayer(b, 's1');
    expect(p.core.classes).toEqual([{ classId: 'late_bloomer', state: 'current', level: 1 }]);
    expect(getLibrary().classes.late_bloomer.name).toBe('Unwritten Legend');
    expect(p.core.perks).toContainEqual({ perkId: 'quick_study', source: 'class', gainedTurn: 0 });
    expect(p.progression!.unspentPerkPoints).toBe(0);
    expect(p.label).toBe('a young stranger');
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([['crude_clothes', ['armor']], ['coin', null], ['bandage', null]]); // 50 points: crude clothes, no weapon yet (Ali)
  });

  it('Quick Study: a marked skill below 15 gets two improvement rolls, each with its own gain', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild('late_bloomer'), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    const p = s.player;
    p.progression!.marks = [SK.dodge, SK.melee_medium]; // dodge 5 (below 15), medium weapons 15 (not below)
    const gains = improveMarked(s, forcedRng([90, 3, 90, 3, 90, 3]));
    expect(gains.filter((g) => g.skill === SK.dodge)).toEqual([{ skill: SK.dodge, from: 5, to: 8 }, { skill: SK.dodge, from: 8, to: 11 }]);
    expect(gains.filter((g) => g.skill === SK.melee_medium)).toHaveLength(1);
  });

  it('class-level perks are granted when a level goes into the class', () => {
    const s = makeVillage();
    getLibrary().classes.swordsman.levelPerks = { 5: ['quick_study'] };
    s.player.core.classes = [{ classId: 'swordsman', state: 'current', level: 4 }];
    awardXp(s, 400, 'test');
    expect(s.player.core.perks.filter((x) => x.source === 'class').map((x) => x.perkId)).toEqual(['quick_study']);
    delete getLibrary().classes.swordsman.levelPerks;
  });

  it('the starter kit: every starter item the skills meet, the best weapon held, a shield beside a one-handed weapon', () => {
    const b = recommendedBuild();
    const p = createPlayer({ ...b, skills: { ...b.skills, [SK.melee_medium]: 40, [SK.earshot]: 40 } }, 's1');
    const kit = p.core.inventory.filter((i) => getLibrary().items[i.itemId].tags?.includes('starter'));
    expect(kit.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([['crude_clothes', null], ['gambeson', ['armor']], ['round_shield', ['hand:left_arm']]]); // no weapon met at 40
    const q = createPlayer(b, 's1');
    expect(q.core.inventory.find((i) => i.equippedIn?.includes('hand:right_arm'))?.itemId).toBe('arming_sword');
  });

  it('Swordsman unlocks at Medium Weapons 40 and Block 40', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild('late_bloomer'), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    unlockClasses(s);
    expect(s.player.core.classes.map((c) => c.classId)).toEqual(['late_bloomer']);
    s.player.core.skills[SK.melee_medium].raw = 40;
    s.player.core.skills[SK.block].raw = 40;
    unlockClasses(s);
    expect(s.player.core.classes).toContainEqual({ classId: 'swordsman', state: 'unlocked', level: 0 });
    expect(s.log.some((l) => l.code === 'class_unlocked')).toBe(true);
  });
});
