// Every fixed bug is written up in docs/bug-fix-log.md: what was wrong and what was done to fix it.
// The fixing PR adds the entry, so a fix never merges without one.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';

const rows = (readFileSync('docs/build-spec.md', 'utf8') as string).split('\n').filter((l) => /^\| BG-\d+/.test(l));
const cells = (l: string) => l.split('|').slice(1, -1).map((c) => c.trim());
const log = readFileSync('docs/bug-fix-log.md', 'utf8') as string;
const entries = log.split('\n## ').slice(1);

describe('bug fix log', () => {
  it('every fixed row in the bug log has an entry', () => {
    const fixed = rows.filter((l) => cells(l).slice(2).some((c) => /^fixed/i.test(c))).map((l) => cells(l)[0]);
    expect(fixed.length).toBeGreaterThan(100);
    expect(fixed.filter((id) => !entries.some((e) => e.split('\n')[0].trim() === id))).toEqual([]);
  });
  it('each entry says what was wrong, what was done and which PR fixed it', () => {
    expect(entries.filter((e) => !/\*\*What was wrong:\*\* \S/.test(e) || !/\*\*What was done:\*\* \S/.test(e) || !/\*\*Fixed by:\*\*.*#\d+/.test(e))
      .map((e) => e.split('\n')[0])).toEqual([]);
  });
});
