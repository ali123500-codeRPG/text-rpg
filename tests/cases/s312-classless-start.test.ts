// 312 A Start with no class (CC6 b): it begins with no class at level 0, the default class (Commoner) open to pick, and
// its levels bank until the player picks a class. Picking one takes every banked level at once. No Start in the library
// is classless today, so a stand-in Start is added for the test.
import { afterEach, describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { classlessStart, createPlayer, defaultClass, playableRaces, raceStartBlock, recommendedBuild, startLevel, validateBuild } from '../../src/library/spawn';
import { awardXp, charLevel, levelTarget, spendXp, xpToNext } from '../../src/engine/xp';
import { CL } from '../../src/library/classIds';
import { ST } from '../../src/library/startIds';
import { perkPointsUpTo } from '../../src/ruleset/levels';
import { makeVillage } from '../harness';
import { toPages } from '../../src/save/pages';
import { checkInvariants, newReport } from '../../src/save/checks';

const FIXTURE = 'ST_test_classless';
const addStart = () => { getLibrary().starts[FIXTURE] = { id: FIXTURE, name: 'Test Classless', level: 3 }; };
afterEach(() => { delete getLibrary().starts[FIXTURE]; });

describe('312 classless start', () => {
  it('begins with no class at level 0, Commoner open to pick, whatever level the Start names', () => {
    addStart();
    expect(classlessStart(FIXTURE)).toBe(true);
    expect(classlessStart(ST.blessed)).toBe(false); // a blessing start takes its god's class
    expect(defaultClass()).toBe(CL.commoner);
    expect(startLevel(FIXTURE)).toBe(0);
    expect(validateBuild(recommendedBuild(FIXTURE))).toEqual([]);
    const p = createPlayer(recommendedBuild(FIXTURE), 's1');
    expect(p.core.classes).toEqual([{ classId: CL.commoner, state: 'unlocked', level: 0 }]);
    expect(charLevel(p)).toBe(0);
    expect(p.progression!.unspentPerkPoints).toBe(perkPointsUpTo(0));
    expect(p.core.perks.filter((x) => x.source === 'class')).toEqual([]);
  });

  it('Commoner is open from the start for every Start and race (unlocked, level 0)', () => {
    for (const st of Object.keys(getLibrary().starts)) for (const r of playableRaces()) {
      if (raceStartBlock(st, r)) continue;
      const p = createPlayer(recommendedBuild(st, r), 's1', { preview: true });
      expect(p.core.classes, `${st} ${r}`).toContainEqual({ classId: CL.commoner, state: 'unlocked', level: 0 });
    }
  });

  it('levels bank until a class is picked; picking takes them all', () => {
    const s = makeVillage(); // the village loads a fresh library
    addStart();
    const p = s.player, fresh = createPlayer(recommendedBuild(FIXTURE), 's1');
    p.core.classes = fresh.core.classes;
    p.progression!.xp = 0;
    const need = xpToNext(p);
    awardXp(s, need * 4, 'test');
    expect(levelTarget(p)).toBeUndefined();
    expect(charLevel(p)).toBe(0);
    expect(p.progression!.xp).toBe(need * 4); // banked
    p.progression!.nextClass = CL.commoner;
    spendXp(s);
    expect(p.core.classes.find((c) => c.classId === CL.commoner)).toMatchObject({ state: 'current' });
    expect(charLevel(p)).toBeGreaterThanOrEqual(2);
  });

  it('a classless player passes the save checks; two current classes do not (BG-328)', () => {
    const s = makeVillage();
    addStart();
    s.player.core.classes = createPlayer(recommendedBuild(FIXTURE), 's1').core.classes;
    const errs = () => { const r = newReport(); checkInvariants(toPages(s), s.storyId, getLibrary(), r); return r.errors.filter((e) => e.includes('current class')); };
    expect(errs()).toEqual([]);
    s.player.core.classes = [{ classId: CL.commoner, state: 'current', level: 1 }, { classId: CL.trader, state: 'current', level: 1 }];
    expect(errs()).toHaveLength(1);
  });
});
