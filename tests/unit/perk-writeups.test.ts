// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { describe, expect, it } from 'vitest';
import { getLibrary, resetLibrary } from '../../src/library';
import { PERK_WRITEUPS } from '../../src/library/perks';
import { canTake } from '../../src/ruleset';
import { perksMarkdown } from '../../src/ui/perkDoc';
import { SK } from '../../src/library/skillIds';

describe('perk write-ups (story and rules views)', () => {
  it('docs/perks.md matches the game data (run npm run perks-doc after editing src/library/perks.ts)', () => {
    expect(readFileSync('docs/perks.md', 'utf8')).toBe(perksMarkdown());
  });
  it('every perk has a story, a trigger and an effect, and ids are unique', () => {
    expect(new Set(PERK_WRITEUPS.map((p) => p.id)).size).toBe(PERK_WRITEUPS.length);
    for (const p of PERK_WRITEUPS) expect([p.story, p.rules.trigger, p.rules.effect, p.rules.lasts].every((t) => t.length > 0)).toBe(true);
  });
  it('the 20 milestone picks are in the library; only built ones can be taken', () => {
    resetLibrary();
    const twenties = PERK_WRITEUPS.filter((p) => p.place === '20');
    expect(twenties).toHaveLength(22); // A1–A17, then A18–A22 for the skills added later
    const L = getLibrary().perks;
    for (const p of twenties) expect(L[p.id]).toMatchObject({ ladder: { skill: p.skill, milestone: 20 }, built: BUILT_PERKS.has(p.id), story: p.story });
    for (const id of BUILT_PERKS) expect(L[id]).toBeDefined(); // no stale ids
    const a = { core: { perks: [], skills: { [SK.melee_medium]: { raw: 40 } } }, progression: { unspentPerkPoints: 1 } } as never;
    expect(canTake(a, 'haggler')).toBe('not in the game yet');
  });
});
