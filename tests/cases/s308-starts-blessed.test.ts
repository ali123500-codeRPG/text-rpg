// 308 Starts (DX1): the creation screen's ways to begin are their own library table, apart from classes. The blessed
// start begins with a random god's Tier V blessing (a perk tagged with its god and tier), in that god's Blessed class;
// while no god gives a Tier V blessing it can't begin. A god's Blessed class opens for anyone that god blesses.
import { afterEach, describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { createPlayer, recommendedBuild, startGives, validateBuild } from '../../src/library/spawn';
import { unlockClasses } from '../../src/engine/xp';
import { CL } from '../../src/library/classIds';
import { GD } from '../../src/library/godIds';
import { ST } from '../../src/library/startIds';
import { PK } from '../../src/library/perkIds';
import { makeVillage } from '../harness';

const FIXTURE = 'PK_test_blessing'; // a stand-in tier V blessing until the essence god's extraction perk is tagged
const bless = () => { getLibrary().perks[FIXTURE] = { id: FIXTURE, name: 'Test Blessing', blessing: { god: GD.essences, tier: 'tier_5' } }; };
afterEach(() => { delete getLibrary().perks[FIXTURE]; });

describe('308 Starts and the blessed start', () => {
  it('every old starting class is a Start with its class, points and level', () => {
    const lib = getLibrary();
    expect(Object.values(lib.starts).map((s) => [s.name, s.classId, s.points, s.level])).toEqual([
      ['Swordsman', CL.swordsman, undefined, undefined], ['Unwritten Legend', CL.late_bloomer, 50, 1], ['A Nobody', CL.a_nobody, 50, 1],
      ['The Threadbound', CL.threadbounded, 50, 1], ['The Blessed', undefined, 50, 1]]);
    expect(createPlayer(recommendedBuild(ST.late_bloomer), 's1').core.classes).toEqual([{ classId: CL.late_bloomer, state: 'current', level: 1 }]);
  });

  it('the blessed start can not begin while no god gives a Tier V blessing', () => {
    if (Object.values(getLibrary().perks).some((p) => p.blessing?.tier === 'tier_5')) return; // the extraction blessing is tagged: covered below
    expect(validateBuild(recommendedBuild(ST.blessed))).toContain('No god gives a Tier V blessing yet');
  });

  it('begins with a random god\'s Tier V blessing, in that god\'s Blessed class; the same story gives the same roll', () => {
    bless();
    expect(validateBuild(recommendedBuild(ST.blessed))).toEqual([]);
    expect(startGives(ST.blessed).classId).toBeUndefined(); // the screen has no story id yet, so no roll
    const p = createPlayer(recommendedBuild(ST.blessed), 's1');
    expect(p.core.classes).toEqual([{ classId: CL.blessed_essences, state: 'current', level: 1 }]);
    const b = p.core.perks.find((x) => getLibrary().perks[x.perkId]?.blessing);
    expect(b && { god: getLibrary().perks[b.perkId].blessing!.god, tier: getLibrary().perks[b.perkId].blessing!.tier, source: b.source })
      .toEqual({ god: GD.essences, tier: 'tier_5', source: 'start' });
    expect(createPlayer(recommendedBuild(ST.blessed), 's1').core.perks).toEqual(p.core.perks);
  });

  it('today the only Tier V blessing is Imbra\'s Extract Essence', () => {
    const p = createPlayer(recommendedBuild(ST.blessed), 's2');
    expect(p.core.perks).toContainEqual({ perkId: PK.extract_essence, source: 'start', gainedTurn: 0 });
    expect(p.core.classes[0].classId).toBe(CL.blessed_essences);
  });

  it('a god\'s Blessed class opens for a character that god blesses, and not before', () => {
    const s = makeVillage(); // the village loads a fresh library
    bless();
    unlockClasses(s);
    expect(s.player.core.classes.some((c) => c.classId === CL.blessed_essences)).toBe(false);
    s.player.core.perks.push({ perkId: FIXTURE, source: 'start', gainedTurn: 0 });
    unlockClasses(s);
    expect(s.player.core.classes).toContainEqual({ classId: CL.blessed_essences, state: 'unlocked', level: 0 });
  });
});
