// 313 Race choice at creation (CC7 a, CC8 b): the player picks any playable race (RaceDef.playable: Human, Elf, Slime and
// Dragon). The race sets the body type, the innate perks and the age range. A start whose class needs a skill the race's
// body can't learn can't begin; the recommended build moves points off closed skills; starter gear goes in the body's
// own grips, and only a humanoid wears the starter armor.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { creationAgeRange, createPlayer, playableRaces, raceStartBlock, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { BT, RC } from '../../src/library/raceIds';
import { ST } from '../../src/library/startIds';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';

describe('313 race choice at creation', () => {
  it('every race is playable (CC8 b)', () => {
    expect(playableRaces()).toEqual([RC.human, RC.elf, RC.slime, RC.dragon]);
  });

  it('a build names its race; left out it is Human', () => {
    expect(createPlayer(recommendedBuild(), 's1').core.raceId).toBe(RC.human);
    const elf = createPlayer({ ...recommendedBuild(), raceId: RC.elf }, 's1');
    expect([elf.core.raceId, elf.core.bodyTypeId]).toEqual([RC.elf, BT.humanoid]);
    const dragon = createPlayer(recommendedBuild(ST.swordsman, RC.dragon), 's1');
    expect([dragon.core.raceId, dragon.core.bodyTypeId]).toEqual([RC.dragon, BT.winged_quadruped]);
  });

  it('a race that is not playable is refused', () => {
    getLibrary().races![RC.slime].playable = undefined;
    try { expect(validateBuild(recommendedBuild(ST.late_bloomer, RC.slime))).toContain('Slime is not a race you can play'); }
    finally { getLibrary().races![RC.slime].playable = true; }
  });

  it('every playable race has a valid recommended build for some start, and one for every start it can begin', () => {
    for (const r of playableRaces()) {
      const ok = Object.keys(getLibrary().starts).filter((s) => !raceStartBlock(s, r));
      expect(ok.length, r).toBeGreaterThan(0);
      for (const s of ok) {
        if (getLibrary().starts[s].blessing) continue; // waits on a god with that tier (s308)
        const b = recommendedBuild(s, r);
        expect(validateBuild(b), `${r} ${s}`).toEqual([]);
        expect(Object.values(b.skills).reduce((n, v) => n + v, 0)).toBeLessThanOrEqual(CONFIG.CREATION_POINTS);
      }
    }
  });

  it('a Slime can\'t begin as a Swordsman: the class needs skills its body can\'t learn', () => {
    expect(raceStartBlock(ST.swordsman, RC.slime)).toMatch(/^a Slime can't learn .*Medium weapons.*, which Swordsman needs\.$/i);
    expect(raceStartBlock(ST.swordsman, RC.human)).toBe('');
    expect(validateBuild(recommendedBuild(ST.swordsman, RC.slime)).some((e) => e.startsWith("This start can't begin"))).toBe(true);
  });

  it('starter gear goes in the body\'s own grips; only a humanoid wears the starter armor', () => {
    const human = createPlayer(recommendedBuild(), 's1').core.inventory.filter((i) => i.equippedIn);
    expect(human.flatMap((i) => i.equippedIn!).sort()).toEqual(['armor', 'grip:right_arm', 'pack']);
    const b = recommendedBuild(); b.skills[SK.block] = 40; b.skills[SK.earshot] -= 30; b.skills[SK.eyesight] -= 10; // a shield is met
    expect(createPlayer(b, 's1').core.inventory.flatMap((i) => i.equippedIn ?? []).sort()).toEqual(['armor', 'grip:left_arm', 'grip:right_arm', 'pack']);
    const dragon = createPlayer(recommendedBuild(ST.swordsman, RC.dragon), 's1').core.inventory.filter((i) => i.equippedIn);
    expect(dragon.flatMap((i) => i.equippedIn!).sort()).toEqual(['grip:head', 'pack']); // jaws hold the weapon; no shield, no armor
    const slime = createPlayer(recommendedBuild(ST.late_bloomer, RC.slime), 's1').core.inventory.filter((i) => i.equippedIn);
    expect(slime.flatMap((i) => i.equippedIn!)).toEqual(['pack']);
  });

  it('the age range is the picked race\'s; a Slime is ageless', () => {
    expect(creationAgeRange(RC.elf)!.max).toBeGreaterThan(creationAgeRange(RC.human)!.max);
    expect(creationAgeRange(RC.slime)).toBeUndefined();
    expect(validateBuild({ ...recommendedBuild(), raceId: RC.elf, age: 200 })).toEqual([]);
    expect(validateBuild({ ...recommendedBuild(), raceId: RC.human, age: 200 }).some((e) => e.startsWith('Age must be'))).toBe(true);
  });
});
