// 308 Starts (DX1): the creation screen's ways to begin are their own library table, apart from classes. The blessed
// start begins with a random god's Tier V blessing (a perk tagged with its god and tier), in that god's Blessed class;
// while no god gives a Tier V blessing it can't begin. A god's Blessed class opens for anyone that god blesses.
import { afterEach, describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { createPlayer, recommendedBuild } from '../../src/library/spawn';
import { unlockClasses } from '../../src/engine/xp';
import { CL } from '../../src/library/classIds';
import { GD } from '../../src/library/godIds';
import { ST } from '../../src/library/startIds';
import { PK } from '../../src/library/perkIds';
import { makeVillage } from '../harness';
import { essenceSkill } from '../../src/ruleset/perks';
import { SK } from '../../src/library/skillIds';

const FIXTURE = 'PK_test_blessing'; // a stand-in tier V blessing until the essence god's extraction perk is tagged
const bless = () => { getLibrary().perks[FIXTURE] = { id: FIXTURE, name: 'Test Blessing', blessing: { god: GD.imbra, tier: 'tier_5' } }; };
afterEach(() => { delete getLibrary().perks[FIXTURE]; });

describe('308 Starts and the blessed start', () => {

  it('today the only Tier V blessing is Imbra\'s Extract Essence', () => {
    const p = createPlayer(recommendedBuild(ST.blessed), 's2');
    expect(p.core.perks).toContainEqual({ perkId: PK.extract_essence, source: 'start', gainedTurn: 0 });
    expect(p.core.classes[0].classId).toBe(CL.blessed_by_imbra);
  });

  it('a Blessed class gives a random Tier I blessing of its god at level 1; Imbra\'s raises what essences give by 10%', () => {
    const p = createPlayer(recommendedBuild(ST.blessed), 's2');
    expect(p.core.perks).toContainEqual({ perkId: PK.imbras_measure, source: 'class', gainedTurn: 0 });
    p.progression!.essences = [{ essence: 'x', grade: 'common', points: { [SK.dodge]: 10 }, turn: 0 }];
    expect(essenceSkill(p, SK.dodge)).toBeCloseTo(11);
    p.core.perks = p.core.perks.filter((x) => x.perkId !== PK.imbras_measure);
    expect(essenceSkill(p, SK.dodge)).toBe(10);
  });

  it('a god\'s Blessed class opens for a character that god blesses, and not before', () => {
    const s = makeVillage(); // the village loads a fresh library
    bless();
    unlockClasses(s);
    expect(s.player.core.classes.some((c) => c.classId === CL.blessed_by_imbra)).toBe(false);
    s.player.core.perks.push({ perkId: FIXTURE, source: 'start', gainedTurn: 0 });
    unlockClasses(s);
    expect(s.player.core.classes).toContainEqual({ classId: CL.blessed_by_imbra, state: 'unlocked', level: 0 });
  });
});
