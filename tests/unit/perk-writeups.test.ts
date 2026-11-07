// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getLibrary, resetLibrary } from '../../src/library';
import { PERK_WRITEUPS } from '../../src/library/perks';
import { canTake } from '../../src/ruleset';
import { perksMarkdown } from '../../src/ui/perkDoc';

describe('perk write-ups (story and rules views)', () => {
  it('docs/perks.md matches the game data (run npm run perks-doc after editing src/library/perks.ts)', () => {
    expect(readFileSync('docs/perks.md', 'utf8')).toBe(perksMarkdown());
  });
  it('every perk has a story, a trigger and an effect, and ids are unique', () => {
    expect(new Set(PERK_WRITEUPS.map((p) => p.id)).size).toBe(PERK_WRITEUPS.length);
    for (const p of PERK_WRITEUPS) expect([p.story, p.rules.trigger, p.rules.effect, p.rules.lasts].every((t) => t.length > 0)).toBe(true);
  });
  it('the 20 milestone picks are in the library but cannot be taken until built', () => {
    resetLibrary();
    const twenties = PERK_WRITEUPS.filter((p) => p.place === '20');
    expect(twenties).toHaveLength(17);
    const L = getLibrary().perks;
    for (const p of twenties) expect(L[p.id]).toMatchObject({ ladder: { skill: p.skill, milestone: 20 }, built: false, story: p.story });
    const a = { core: { perks: [], skills: { melee_light: 40 } }, progression: { unspentPerkPoints: 1 } } as never;
    expect(canTake(a, 'hidden_strike')).toBe('not in the game yet');
  });
});
