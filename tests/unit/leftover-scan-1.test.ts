// Leftover-rule scan, round 1: one contest rule, one capitalising helper, one empty journal, margin bands in config, and
// spec prose that names only code names that still exist.
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { CONFIG, resetConfig } from '../../src/config';
import { band, toContest } from '../../src/ruleset';
import { cap } from '../../src/words';
import { journalOf } from '../../src/engine/trail';
import type { Actor, RollResult } from '../../src/types';

// files the leftover scan has covered (add each round's files)
const SCANNED = ['src/ui/play.ts', 'src/ruleset/index.ts', 'src/scenario/apply.ts', 'src/minds/state.ts', 'src/engine/heal.ts'];
// names the spec mentions only to say they are gone
const GONE_ON_PURPOSE = ['LINK_PACES'];
const roll = (tier: RollResult['tier'], beyond?: number) => ({ tier, ...(beyond ? { beyond } : {}) }) as RollResult;
const files = (dir: string): string[] => (readdirSync(dir) as string[]).flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(p).isDirectory() ? files(p) : /\.(ts|mjs)$/.test(p) ? [p] : [];
});

afterEach(() => resetConfig());

describe('leftover scan round 1', () => {
  it('a contest is b’s tier level minus a’s; the acting side wins below 0', () => {
    expect(toContest(roll('success'), roll('failure'))).toMatchObject({ gap: -2, winner: 'a' });
    expect(toContest(roll('near_miss'), roll('near_miss'))).toMatchObject({ gap: 0, winner: 'tie' });
    expect(toContest(roll('critical_success'), roll('critical_success', 1))).toMatchObject({ gap: 1, winner: 'b' });
  });

  it('margin bands are read from CONFIG', () => {
    CONFIG.MARGIN_BANDS = [-75, -25, 0, 25, 70];
    expect(band(72)).toBe(5);
    resetConfig();
    expect(band(72)).toBe(4);
  });

  it('cap capitalises the first letter only', () => {
    expect(cap('the guard')).toBe('The guard');
    expect(cap('')).toBe('');
  });

  it('journalOf makes a whole empty journal once and keeps it', () => {
    const p = {} as Actor;
    const j = journalOf(p);
    expect(j).toEqual({ secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
    expect(journalOf(p)).toBe(j);
  });

  it('scanned files have no doc comment stacked on another (one of them belongs elsewhere)', () => {
    expect(SCANNED.filter((f) => /\*\/\n[ \t]*\/\*\*/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('no copy of the capitalising helper is left', () => {
    const copies = files('src').filter((f) => f !== 'src/words.ts' && /const cap = \(/.test(readFileSync(f, 'utf8') as string));
    expect(copies).toEqual([]);
  });

  it('every code name the spec prose gives (UPPER_SNAKE) exists in the code (src, tests, scripts)', () => {
    const src = [...files('src'), ...files('tests'), ...files('scripts')].filter((f) => !f.endsWith('leftover-scan-1.test.ts')).map((f) => readFileSync(f, 'utf8') as string).join('\n');
    // tables of record (bug log, decisions, answers) keep the names of their day
    const prose = (readFileSync('docs/build-spec.md', 'utf8') as string).split('\n').filter((l) => !/^\| [A-Z]+[-0-9]/.test(l)).join('\n');
    const names = [...new Set(prose.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g) ?? [])];
    const missing = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(src) && !GONE_ON_PURPOSE.includes(n));
    expect(missing).toEqual([]);
  });
});
