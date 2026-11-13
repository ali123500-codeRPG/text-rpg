// TQ8: every bug-log row names its fix by PR number, so a bug can be followed to its fix and its test. "this PR" is
// never merged: open the PR first, then write its number into the row.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';

const rows = (readFileSync('docs/build-spec.md', 'utf8') as string).split('\n').filter((l) => /^\| BG-\d+ \|/.test(l));
const cells = (l: string) => l.split('|').slice(1, -1).map((c) => c.trim());

describe('bug log (TQ8)', () => {
  it('has rows, each BG number once', () => {
    expect(rows.length).toBeGreaterThan(100);
    const ids = rows.map((l) => cells(l)[0]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
  it('no row says "this PR": each names its PR number', () => {
    expect(rows.filter((l) => /this PR/i.test(l)).map((l) => l.slice(0, 12))).toEqual([]);
  });
  it('every fixed row names the PR that fixed it', () => {
    expect(rows.filter((l) => cells(l).some((c) => /^fixed/i.test(c)) && !/#\d+/.test(l)).map((l) => cells(l)[0])).toEqual([]);
  });
});
