// 313 Race choice at creation (CC7 a): the player picks a playable race (RaceDef.playable: Human and Elf; Slime and Dragon
// were playable under CC8 b, then taken off again). The race sets the body type, the innate perks and the age range. A start whose class needs a skill the race's
// body can't learn can't begin; the recommended build moves points off closed skills; starter gear goes in the body's
// own grips, and only a humanoid wears the starter armor.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { createPlayer, playableRaces, raceStartBlock, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { BT, RC } from '../../src/library/raceIds';
import { ST } from '../../src/library/startIds';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { readied } from '../../src/engine/combatLevel';
import { makeVillage } from '../harness';


describe('313 race choice at creation', () => {
  it('a build names its race; left out it is Human', () => {
    expect(createPlayer(recommendedBuild(), 's1').core.raceId).toBe(RC.human);
    const elf = createPlayer({ ...recommendedBuild(), raceId: RC.elf }, 's1');
    expect([elf.core.raceId, elf.core.bodyTypeId]).toEqual([RC.elf, BT.humanoid]);
    const dragon = createPlayer(recommendedBuild(ST.late_bloomer, RC.dragon), 's1', { preview: true }); // the body still follows the race
    expect([dragon.core.raceId, dragon.core.bodyTypeId]).toEqual([RC.dragon, BT.winged_quadruped]);
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

  it('starter gear goes in the body\'s own grips; only a humanoid wears the starter armor', () => {
    const human = createPlayer(recommendedBuild(), 's1').core.inventory.filter((i) => i.equippedIn);
    expect(human.flatMap((i) => i.equippedIn!).sort()).toEqual(['armor', 'pack']); // DS2: weapons start sheathed
    const b = recommendedBuild(); b.skills[SK.block] = 25; b.skills[SK.earshot] -= 5; b.skills[SK.eyesight] -= 5; b.skills[SK.dodge] -= 10; b.skills[SK.endurance] -= 5; // a shield is met
    const shielded = readied(makeVillage(), createPlayer(b, 's1'), true); // drawn to fight: into its own grips
    expect(shielded.core.inventory.flatMap((i) => i.equippedIn ?? []).sort()).toEqual(['armor', 'grip:left_arm', 'grip:right_arm', 'pack']);
    const dragon = readied(makeVillage(), createPlayer(recommendedBuild(ST.late_bloomer, RC.dragon), 's1', { preview: true }), true).core.inventory.filter((i) => i.equippedIn);
    expect(dragon.flatMap((i) => i.equippedIn!).sort()).toEqual(['grip:head', 'pack']); // jaws hold the weapon; no shield, no armor
    const slime = createPlayer(recommendedBuild(ST.late_bloomer, RC.slime), 's1', { preview: true }).core.inventory.filter((i) => i.equippedIn);
    expect(slime.flatMap((i) => i.equippedIn!)).toEqual(['pack']);
  });

});
