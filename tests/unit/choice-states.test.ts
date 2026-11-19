// P5 choice states and A6 risky choices: can't-afford names the shortfall, a class not yet open says Locked, a choice
// that can't be undone asks once in place, and the creation screen's Reset gets an Undo instead of a question.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('choice states (P5) and risky choices (A6)', () => {
  it('a perk with no point names the shortfall; a class not open yet is Locked', () => {
    expect(src('perks.ts')).toMatch(/pts < 1 \? `Needs \$\{1 - pts\} more point`/);
    expect(src('classTree.ts')).toMatch(/n\.shown === 'next' \? 'Locked'/);
  });

  it('giving an essence up and letting one go ask once, in place; taking into a free slot does not', () => {
    const e = src('essences.ts');
    expect(e).toMatch(/onclick: \(\) => askInPlace\(acts, `\$\{nameOf\(x\)\} is gone for good/);
    expect(e).toMatch(/onclick: \(\) => askInPlace\(acts, 'This essence is gone for good\.', 'Let it go'/);
    expect(e).toMatch(/onclick: \(\) => run\(`\/essence take \$\{i \+ 1\}`\) \}, 'Take it'\)/);
    expect(src('kit.ts')).not.toMatch(/confirm\(|window\.confirm/);
  });

  it('Reset and the recommended build keep the build before for Undo, which ends at the next change', () => {
    const c = src('creation.ts');
    expect(c).toMatch(/snap\(\); reset\(\); afterKey = buildKey\(\); render\(\);/);
    expect(c).toMatch(/snap\(\); recommended\(\); afterKey = buildKey\(\); render\(\);/);
    expect(c).toMatch(/if \(before && buildKey\(\) !== afterKey\) \{ before = null; undoBtn\.hidden = true; \}/);
  });
});
