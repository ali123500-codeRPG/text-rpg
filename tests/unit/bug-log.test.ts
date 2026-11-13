// TQ8: every bug-log row names its fix by PR number, so a bug can be followed to its fix and its test. "this PR" is
// never merged: open the PR first, then write its number into the row.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';

const rows = (readFileSync('docs/build-spec.md', 'utf8') as string).split('\n').filter((l) => /^\| BG-\d+ \|/.test(l));

describe('bug log (TQ8)', () => {
  it('has rows', () => expect(rows.length).toBeGreaterThan(100));
  it('no row says "this PR": each names its PR number', () => {
    expect(rows.filter((l) => /this PR/i.test(l)).map((l) => l.slice(0, 12))).toEqual([]);
  });
});
