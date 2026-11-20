// TQ8: every bug-log row names its fix by number (the claim issue, or for older rows the PR), so a bug can be followed
// to its fix and its test. WF3 a: from BG-327 a row is one line and its story lives only in docs/bug-fix-log.md.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { BUG_LOGS } from '../harness/specDocs';

const rows = BUG_LOGS.map((f) => readFileSync(f, 'utf8') as string).join('\n').split('\n').filter((l) => /^\| BG-\d+ \|/.test(l));
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
  it('every fixed row names the issue or PR that fixed it', () => {
    expect(rows.filter((l) => cells(l).some((c) => /^fixed/i.test(c)) && !/#\d+/.test(l)).map((l) => cells(l)[0])).toEqual([]);
  });
  it('every row is one line on what was wrong (older rows too, #1160)', () => {
    expect(rows.filter((l) => cells(l)[1].length > 160).map((l) => cells(l)[0])).toEqual([]);
  });
  it('a row after BG-326 is one line on what was wrong and names its claim issue', () => {
    const LAST_OLD_FORM = 326, ONE_LINE = 160;
    const fresh = rows.filter((l) => Number(cells(l)[0].slice(3)) > LAST_OLD_FORM);
    expect(fresh.filter((l) => cells(l)[1].length > ONE_LINE || !/^#\d+$/.test(cells(l)[4] ?? '')).map((l) => cells(l)[0])).toEqual([]);
  });
});
