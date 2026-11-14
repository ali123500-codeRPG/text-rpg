// 128 Starts and class-level perks: Swordsman floors are Medium Weapons 40 and Block 40, which
// also unlock the class; the late bloomer starts as an Unwritten Legend with 50 points at level 1 and the class's level 1
// perk Quick Study (two improvement rolls for a skill below 15). Classes can grant perks at any level.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { awardXp, unlockClasses } from '../../src/engine/xp';
import { improveMarked } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { ST } from '../../src/library/startIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

describe('128 Late bloomer and class-level perks', () => {
  it('the late bloomer: 100 points, no floors, level 1, Quick Study, no Swordsman tree', () => {
    const b = recommendedBuild(ST.late_bloomer);
    expect(validateBuild(b)).toEqual([]);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.dodge]: 15 } })).toEqual(['Spend exactly 100 points (105 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.riposte]: 5, [SK.dodge]: 5 } })).toEqual(['Riposte is not open to the point-buy']);
    const p = createPlayer(b, 's1');
    expect(p.core.classes).toEqual([{ classId: CL.late_bloomer, state: 'current', level: 1 }, { classId: CL.commoner, state: 'unlocked', level: 0 }]); // Commoner is open from the start
    expect(getLibrary().classes[CL.late_bloomer].name).toBe('Unwritten Legend');
    expect(p.core.perks).toContainEqual({ perkId: PK.quick_study, source: 'class', gainedTurn: 0 });
    expect(p.progression!.unspentPerkPoints).toBe(0);
    expect(p.label).toBe('a young stranger');
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([[IT.crude_clothes, ['armor']], [IT.hand_axe, ['grip:right_arm']], [IT.pack, ['pack']], [IT.coin, null], [IT.bandage, null]]); // Medium Weapons 40: the Common hand axe; no Light Armor: crude clothes; CT7: a worn pack
  });

  it('Quick Study: a marked skill below 15 gets two improvement rolls, each with its own gain', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild(ST.late_bloomer), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    const p = s.player;
    p.progression!.marks = [SK.dodge, SK.melee_medium]; // dodge 10 (below 15), medium weapons 40 (not below)
    const gains = improveMarked(s, forcedRng([90, 90, 90])); // each margin 75 or more: Critical Success, +4
    expect(gains.filter((g) => g.skill === SK.dodge)).toEqual([{ skill: SK.dodge, from: 10, to: 14 }, { skill: SK.dodge, from: 14, to: 18 }]);
    expect(gains.filter((g) => g.skill === SK.melee_medium)).toHaveLength(1);
  });

  it('class-level perks are granted when a level goes into the class', () => {
    const s = makeVillage();
    getLibrary().classes[CL.swordsman].levelPerks = { 5: [PK.quick_study] };
    s.player.core.classes = [{ classId: CL.swordsman, state: 'current', level: 4 }];
    awardXp(s, 400, 'test');
    expect(s.player.core.perks.filter((x) => x.source === 'class').map((x) => x.perkId)).toEqual([PK.quick_study]);
    delete getLibrary().classes[CL.swordsman].levelPerks;
  });

  it('the starter kit: the highest starter item met per gear class, the best weapon held, a shield beside a one-handed weapon', () => {
    const b = recommendedBuild();
    const p = createPlayer({ ...b, skills: { [SK.melee_medium]: 40, [SK.parry]: 5, [SK.endurance]: 0, [SK.eyesight]: 5, [SK.block]: 25, [SK.light_armor]: 25 } }, 's1'); // Block 25 meets the round shield, Light Armor 25 the gambeson
    const kit = p.core.inventory.filter((i) => getLibrary().items[i.itemId].tags?.includes('starter'));
    expect(kit.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([[IT.gambeson, ['armor']], [IT.round_shield, ['grip:left_arm']], [IT.hand_axe, ['grip:right_arm']]]); // Medium Weapons 40: the Common hand axe
    const q = createPlayer(b, 's1'); // no skill passes 40 at creation, so no Fine (50) piece is met
    expect(q.core.inventory.find((i) => i.equippedIn?.includes('grip:right_arm'))?.itemId).toBe(IT.hand_axe);
  });

  it('Swordsman unlocks at Medium Weapons 40 and Parry 40', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild(ST.late_bloomer), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    unlockClasses(s);
    expect(s.player.core.classes.map((c) => c.classId)).toEqual([CL.late_bloomer, CL.commoner]);
    s.player.core.skills[SK.melee_medium].raw = 40;
    s.player.core.skills[SK.parry].raw = 40;
    unlockClasses(s);
    expect(s.player.core.classes).toContainEqual({ classId: CL.swordsman, state: 'unlocked', level: 0 });
    expect(s.log.some((l) => l.code === 'class_unlocked')).toBe(true);
  });

  it('Sword-dancer unlocks at Dodge 40 and either Light or Medium Weapons 40', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild(ST.late_bloomer), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    s.player.core.skills[SK.melee_medium].raw = 30;
    s.player.core.skills[SK.dodge].raw = 40;
    unlockClasses(s);
    expect(s.player.core.classes.map((c) => c.classId)).toEqual([CL.late_bloomer, CL.commoner]); // Dodge alone is not enough
    s.player.core.skills[SK.melee_light] = { ...s.player.core.skills[SK.melee_light], raw: 40 };
    unlockClasses(s);
    expect(s.player.core.classes).toContainEqual({ classId: CL.sword_dancer, state: 'unlocked', level: 0 });
    expect(s.player.core.classes.some((c) => c.classId === CL.swordsman)).toBe(false);
  });
});
