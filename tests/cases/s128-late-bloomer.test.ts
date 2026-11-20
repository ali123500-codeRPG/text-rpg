// 128 Starts and class-level perks: Swordsman floors are Medium Weapons 40 and Block 40, which
// also unlock the class; the late bloomer starts as an Unwritten Legend with 50 points at level 1 and the class's level 1
// perk Any Road Will Do (UL1); Quick Study (two improvement rolls for a skill below 15) is A Nobody's (UL2). Classes can grant perks at any level.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { awardXp, xpToNext } from '../../src/engine/xp';
import { improveMarked } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';
import { ST } from '../../src/library/startIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

describe('128 Late bloomer and class-level perks', () => {
  it('the late bloomer: 100 points, no floors, level 1, Any Road Will Do, no Swordsman tree', () => {
    const b = recommendedBuild(ST.late_bloomer);
    expect(validateBuild(b)).toEqual([]);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.dodge]: 15 } })).toEqual(['Spend exactly 100 points (105 spent)']);
    expect(validateBuild({ ...b, skills: { ...b.skills, [SK.riposte]: 5, [SK.dodge]: 5 } })).toEqual(['Riposte is not open to the point-buy']);
    const p = createPlayer(b, 's1');
    expect(p.core.classes).toEqual([{ classId: CL.late_bloomer, state: 'current', level: 1 }, { classId: CL.commoner, state: 'unlocked', level: 0 }]); // Commoner is open from the start
    expect(p.core.perks).toContainEqual({ perkId: PK.any_road_will_do, source: 'class', gainedTurn: 0 });
    expect(p.core.perks.some((x) => x.perkId === PK.quick_study)).toBe(false); // UL2: Quick Study is A Nobody's own
    expect(p.progression!.unspentPerkPoints).toBe(0);
    expect(p.core.inventory.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([[IT.dagger, null], [IT.arming_sword, ['grip:right_arm']], [IT.crude_clothes, ['armor']], [IT.woodsman_axe, null], [IT.pack, ['pack']], [IT.coin, null], [IT.bandage, null]]); // Medium Weapons 40 points, tagged: 50 (YB1), the Fine arming sword, and its stand-ins meet the dagger and woodsman's axe; no Light Armor: crude clothes; CT7: a worn pack
  });

  it('Quick Study: a marked skill below 15 gets two improvement rolls, each with its own gain', () => {
    const s = makeVillage();
    s.player = { ...createPlayer(recommendedBuild(ST.late_bloomer), 'test'), zone: s.player.zone, placeId: s.player.placeId };
    const p = s.player;
    p.core.perks.push({ perkId: PK.quick_study, source: 'class', gainedTurn: 0 }); // as A Nobody gets it at level 1
    p.progression!.marks = [SK.dodge, SK.melee_medium]; // dodge 10 (below 15), medium weapons 40 (not below)
    const gains = improveMarked(s, forcedRng([90, 90, 90])); // every roll gains (D-383: margin ÷ 15, rounded up)
    const dodge = gains.filter((g) => g.skill === SK.dodge);
    expect(dodge).toHaveLength(2);
    expect(dodge[0].from).toBe(10);
    expect(dodge[1].from).toBe(dodge[0].to); // the second roll starts where the first left it
    expect(dodge.every((g) => g.to > g.from)).toBe(true);
    expect(gains.filter((g) => g.skill === SK.melee_medium)).toHaveLength(1);
  });

  it('class-level perks are granted when a level goes into the class', () => {
    const s = makeVillage();
    getLibrary().classes[CL.swordsman].levelPerks = { 5: [PK.quick_study] };
    s.player.core.classes = [{ classId: CL.swordsman, state: 'current', level: 4 }];
    awardXp(s, xpToNext(s.player), 'test');
    expect(s.player.core.perks.filter((x) => x.source === 'class').map((x) => x.perkId)).toEqual([PK.quick_study]);
    delete getLibrary().classes[CL.swordsman].levelPerks;
  });

  it('the starter kit: the highest starter item met per gear class, the best weapon held, a shield beside a one-handed weapon', () => {
    const b = recommendedBuild();
    const p = createPlayer({ ...b, skills: { [SK.melee_medium]: 40, [SK.parry]: 5, [SK.endurance]: 0, [SK.eyesight]: 5, [SK.block]: 25, [SK.light_armor]: 25 } }, 's1'); // Block 25 meets the round shield, Light Armor 25 the gambeson
    const kit = p.core.inventory.filter((i) => getLibrary().items[i.itemId].tags?.includes('starter'));
    expect(kit.map((i) => [i.itemId, i.equippedIn ?? null])).toEqual([[IT.dagger, null], [IT.arming_sword, ['grip:right_arm']], [IT.gambeson, ['armor']], [IT.round_shield, ['grip:left_arm']], [IT.woodsman_axe, null]]); // Medium Weapons 40 points, tagged: 50 (YB1), the Fine arming sword
    const q = createPlayer({ ...b, skills: { ...b.skills, [SK.melee_medium]: 35, [SK.dodge]: 15 } }, 's1'); // tagged Medium Weapons at 35 points starts at 45: no Fine (50) piece
    expect(q.core.inventory.find((i) => i.equippedIn?.includes('grip:right_arm'))?.itemId).toBe(IT.hand_axe);
  });

});
