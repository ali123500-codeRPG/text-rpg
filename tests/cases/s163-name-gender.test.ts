// Creation names the character and sets their gender: the player's pronouns are what others use for them.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { createPlayer, recommendedBuild } from '../../src/library/spawn';

describe('163 name and gender at creation', () => {
  it('the build carries the name and pronouns onto the player', () => {
    makeVillage();
    const p = createPlayer({ ...recommendedBuild(), name: ' Mira ', pronouns: 'she' }, 'story_x');
    expect(p.names.current).toBe('Mira');
    expect(p.pronouns).toBe('she');
    expect(createPlayer({ ...recommendedBuild(), name: 'Rook' }, 'story_x').pronouns).toBeUndefined(); // left out: they
  });
});
