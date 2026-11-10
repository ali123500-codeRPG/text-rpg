// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { describe, expect, it } from 'vitest';
import { getLibrary, resetLibrary } from '../../src/library';
import { PERK_WRITEUPS } from '../../src/library/perks';
import { canTake } from '../../src/ruleset';
import { perksMarkdown } from '../../src/ui/perkDoc';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';

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
    expect(twenties).toHaveLength(25); // A1–A17, then A18–A23, Bluff (LI1c) and Overheard (LI5a) for the skills added later
    const L = getLibrary().perks;
    for (const p of twenties) expect(L[p.id]).toMatchObject({ ladder: { skill: p.skill, milestone: 20 }, built: BUILT_PERKS.has(p.id), story: p.story });
    for (const id of BUILT_PERKS) expect(L[id]).toBeDefined(); // no stale ids
    const a = { core: { perks: [], skills: { [SK.melee_medium]: { raw: 40 } } }, progression: { unspentPerkPoints: 1 } } as never;
    expect(canTake(a, PK.step_and_cut)).toBe('not in the game yet');
    expect(canTake(a, PK.haggler)).toBe('milestone not reached'); // built, but Barter is under 20
  });
  it('every write-up with no ladder yet says what it is banked as, with a fitting suggested milestone', () => {
    const banked = PERK_WRITEUPS.filter((p) => !p.ladder && ['higher', 'very_high', 'banked'].includes(p.place));
    expect(banked.length).toBeGreaterThan(0);
    for (const p of banked) {
      expect(p.bankedAs, p.ref).toBeDefined();
      if (p.bankedAs === 'milestone' && p.aimAt) expect([60, 100, 140], p.ref).toContain(p.aimAt);
      if (p.bankedAs === 'allX' && p.aimAt) expect([100, 150], p.ref).toContain(p.aimAt);
    }
    for (const p of PERK_WRITEUPS.filter((x) => x.ladder)) expect(p.bankedAs, p.ref).toBeUndefined();
    // a suggestion never lands on a milestone a skill already fills
    const taken = new Set(PERK_WRITEUPS.filter((p) => p.ladder).map((p) => `${p.ladder!.skill}:${p.ladder!.milestone}`));
    for (const p of banked.filter((x) => x.bankedAs === 'milestone' && x.aimAt)) expect(taken.has(`${p.skill}:${p.aimAt}`), p.ref).toBe(false);
  });
});
