// TQ8: every bug-log row names its fix by PR number, so a bug can be followed to its fix and its test. "this PR" is
// never merged: open the PR first, then write its number into the row.
// The bug log and the decision log each keep open rows in one file and closed rows in an archive, so the file a
// thread reads stays short; each number appears once across the pair.
import { describe, expect, it } from 'vitest';
import { BUG_LOG, BUG_LOG_ARCHIVE, DECISION_LOG, DECISION_LOG_ARCHIVE, readDocs } from '../harness/specDocs';

const tableRows = (re: RegExp, ...files: string[]) => readDocs(...files).split('\n').filter((l) => re.test(l));
const BG_ROW = /^\| BG-\d+ \|/, D_ROW = /^\| D-\d+ \|/;
const rows = tableRows(BG_ROW, BUG_LOG, BUG_LOG_ARCHIVE);
const cells = (l: string) => l.split('|').slice(1, -1).map((c) => c.trim());
const BUG_CLOSED = /^(fixed|won.?t fix|duplicate|engine fixed)/i, D_CLOSED = /^(Built|Settled|Dropped|Superseded)/;
const bugClosed = (l: string) => cells(l).slice(2).some((c) => BUG_CLOSED.test(c));
const dClosed = (l: string) => D_CLOSED.test(cells(l)[3]);
const ids = (ls: string[]) => ls.map((l) => cells(l)[0]);
const repeats = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('bug log (TQ8)', () => {
  it('has rows, each BG number once', () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(repeats(ids(rows))).toEqual([]);
  });
  it('no row says "this PR": each names its PR number', () => {
    expect(rows.filter((l) => /this PR/i.test(l)).map((l) => l.slice(0, 12))).toEqual([]);
  });
  it('every fixed row names the PR that fixed it', () => {
    expect(rows.filter((l) => cells(l).some((c) => /^fixed/i.test(c)) && !/#\d+/.test(l)).map((l) => cells(l)[0])).toEqual([]);
  });
  it('open bugs are in the bug log, closed ones in its archive', () => {
    expect(ids(tableRows(BG_ROW, BUG_LOG).filter(bugClosed))).toEqual([]);
    expect(ids(tableRows(BG_ROW, BUG_LOG_ARCHIVE).filter((l) => !bugClosed(l)))).toEqual([]);
  });
});

describe('decision log', () => {
  it('each D number once; open items in the log, closed ones in its archive', () => {
    const all = tableRows(D_ROW, DECISION_LOG, DECISION_LOG_ARCHIVE);
    expect(all.length).toBeGreaterThan(300);
    expect(repeats(ids(all))).toEqual([]);
    expect(ids(tableRows(D_ROW, DECISION_LOG).filter(dClosed))).toEqual([]);
    expect(ids(tableRows(D_ROW, DECISION_LOG_ARCHIVE).filter((l) => !dClosed(l)))).toEqual([]);
  });
});
