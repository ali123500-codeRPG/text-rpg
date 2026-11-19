// G3: every game term on screen has one tip with its plain meaning, from one table in src/words.ts.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_TERMS, termAttrs, termMeaning } from '../../src/words';
import { TIERS } from '../../src/scales';

describe('game terms (G3)', () => {
  it('every tier name, Burden, Thread, All steps and both perk series have a meaning', () => {
    for (const k of TIERS.keys) expect(termMeaning(TIERS.name(k)), k).toBeTruthy();
    for (const w of ['Critical Success++', 'Critical Failure−', 'Burden', 'The Thread', 'All-50', 'All-150', 'Breakthrough', 'Refinement', 'Near Miss']) expect(termMeaning(w), w).toBeTruthy();
    expect(termMeaning('Sword')).toBeUndefined();
    expect(termAttrs('Burden')).toEqual({ title: GAME_TERMS.Burden, 'data-term': '' });
  });

  it('the places that show these terms take their tip from the table', () => {
    const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');
    expect(src('play.ts')).toMatch(/const tierChip = \(t: TierRoll\) => h\('span', \{ \.\.\.termAttrs\(tierName\(t\)\)/);
    expect(src('charsheet.ts')).toMatch(/line\('Burden', `[^`]*`, 'sk-bad', termAttrs\('Burden'\)\)/);
    expect(src('gains.ts')).toMatch(/class: 'hs-label g-label', \.\.\.termAttrs\(label\)/);
    expect(src('perks.ts')).toMatch(/h\('b', termAttrs\(`All-\$\{m\}`\), `All-\$\{m\}`\)/);
  });
});
