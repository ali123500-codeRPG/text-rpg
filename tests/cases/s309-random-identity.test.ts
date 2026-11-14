// 309 Random identity: a new character opens on a random name, gender, age and personality, all editable. Age stays from
// the race's Youth start to just before its Old start (no old-age decline at the start); the personality is a random
// archetype on a random Nerve line; every pick makes a valid build.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/rng';
import { randomIdentity, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { PLAYER_NAMES } from '../../src/library/names';
import { ST } from '../../src/library/startIds';

describe('309 random identity at creation', () => {
  it('every pick is a valid build, the age is Youth to before Old, and the name fits the gender', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = randomIdentity(createRng(seed));
      seen.add(r.pronouns);
      expect(r.age).toBeGreaterThanOrEqual(13);
      expect(r.age).toBeLessThan(60);
      expect(r.pronouns === 'they' ? [...PLAYER_NAMES.he, ...PLAYER_NAMES.she] : PLAYER_NAMES[r.pronouns]).toContain(r.name);
      expect(validateBuild({ ...recommendedBuild(ST.late_bloomer), ...r })).toEqual([]);
    }
    expect([...seen].sort()).toEqual(['he', 'she', 'they']);
  });

  it('the same seed gives the same character', () => {
    expect(randomIdentity(createRng(7))).toEqual(randomIdentity(createRng(7)));
  });
});
