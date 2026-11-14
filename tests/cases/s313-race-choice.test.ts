// 313 Race choice at creation (CC7 a): the player picks a playable race (RaceDef.playable; Human and Elf for now). The
// race sets the body type, the innate perks and the age range; a race that is not playable is refused.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { creationAgeRange, createPlayer, playableRaces, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { BT, RC } from '../../src/library/raceIds';
import { ST } from '../../src/library/startIds';

describe('313 race choice at creation', () => {
  it('Human and Elf are playable; Slime and Dragon are not yet', () => {
    expect(playableRaces()).toEqual([RC.human, RC.elf]);
    for (const id of playableRaces()) expect(getLibrary().races![id].tags).toContain('speaks');
  });

  it('a build names its race; left out it is Human', () => {
    expect(createPlayer(recommendedBuild(), 's1').core.raceId).toBe(RC.human);
    const elf = createPlayer({ ...recommendedBuild(), raceId: RC.elf }, 's1');
    expect([elf.core.raceId, elf.core.bodyTypeId]).toEqual([RC.elf, BT.humanoid]);
  });

  it('a race that is not playable is refused', () => {
    expect(validateBuild({ ...recommendedBuild(ST.late_bloomer), raceId: RC.slime })).toContain('Slime is not a race you can play');
  });

  it('the age range is the picked race\'s', () => {
    const elf = creationAgeRange(RC.elf)!;
    expect(elf.max).toBeGreaterThan(creationAgeRange(RC.human)!.max);
    expect(validateBuild({ ...recommendedBuild(), raceId: RC.elf, age: 200 })).toEqual([]);
    expect(validateBuild({ ...recommendedBuild(), raceId: RC.human, age: 200 }).some((e) => e.startsWith('Age must be'))).toBe(true);
  });
});
