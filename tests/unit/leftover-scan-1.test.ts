// Leftover-rule scan, round 1: one contest rule, one capitalising helper, one empty journal, margin bands in config, and
// spec prose that names only code names that still exist.
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { CONFIG, resetConfig } from '../../src/config';
import { band, ruleset, toContest } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { makeVillage, place, forcedRng } from '../harness';
import { M_EPS } from '../../src/engine/position';
import { MILESTONES } from '../../src/ruleset/perks';
import { perkSeries } from '../../src/ui/perks';
import { cap, r1 } from '../../src/words';
import { journalOf } from '../../src/engine/trail';
import type { Actor, RollResult } from '../../src/types';

// files the leftover scan has covered (add each round's files)
const ROUND_1 = ['src/ui/play.ts', 'src/ruleset/index.ts', 'src/scenario/apply.ts', 'src/minds/state.ts', 'src/engine/heal.ts'];
const ROUND_2 = ['src/engine/resolve.ts', 'src/agents/prompts.ts', 'src/engine/merge.ts', 'src/ui/perks.ts'];
const ROUND_3 = ['src/views/index.ts', 'src/agents/game.ts', 'src/engine/effects.ts'];
const SCANNED = [...ROUND_1, ...ROUND_2, ...ROUND_3];
// files whose GAP notes are settled into the spec (round 1: CS2)
const GAPS_SETTLED = ROUND_1;
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

  it('CS3: the hit outcome thresholds are read from CONFIG.HIT_GAPS', () => {
    // the s078 blow: gap −6 against the slime's dodge (makeVillage resets CONFIG, so the change comes after it)
    const blow = (gaps: Partial<typeof CONFIG.HIT_GAPS>) => {
      const s = makeVillage();
      place(s, 'player', 'field_mid');
      s.player.core.skills[SK.melee_medium].raw = 60;
      CONFIG.HIT_GAPS = { ...CONFIG.HIT_GAPS, ...gaps };
      return ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([100, 3, 50]));
    };
    expect(blow({})).toMatchObject({ gap: -6, outcome: 'crushing_hit' });
    expect(blow({ crushing: -7 })).toMatchObject({ gap: -6, outcome: 'heavy_hit' });
    expect(blow({ heavy: -7, crushing: -8 })).toMatchObject({ gap: -6, outcome: 'full_hit' });
  });

  it('CS2: settled files keep no GAP notes (each was settled into the spec)', () => {
    expect(GAPS_SETTLED.filter((f) => /\bGAP:/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('round 2: walk distances use the one metres tolerance (M_EPS), not a 0.01 of their own', () => {
    expect(M_EPS).toBe(0.01);
    expect(['src/engine/resolve.ts', 'src/engine/merge.ts'].filter((f) => /\b0\.01\b/.test(readFileSync(f, 'utf8') as string))).toEqual([]);
  });

  it('round 2: the perk series key lists its milestones from MILESTONES', () => {
    expect(MILESTONES.filter((m) => perkSeries(m) === '20')).toEqual([20, 60, 100, 140]);
    expect(MILESTONES.filter((m) => perkSeries(m) === '40')).toEqual([40, 80, 120]);
    expect(readFileSync('src/ui/perks.ts', 'utf8') as string).not.toMatch(/'\s*20, 60, 100, 140'|'\s*40, 80, 120'/);
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

  it('no copy of the capitalising helper is left (round 3: nor written inline)', () => {
    const inline = /const cap = \(|charAt\(0\)\.toUpperCase\(\) \+|\[0\]\.toUpperCase\(\)\}\$\{|replace\(\/\^\.\/, \(\w\) => \w\.toUpperCase\(\)\)/;
    const copies = files('src').filter((f) => f !== 'src/words.ts' && f !== 'src/library/data.ts' && inline.test(readFileSync(f, 'utf8') as string));
    expect(copies).toEqual([]);
  });

  it('round 3: one-decimal rounding has one helper (r1)', () => {
    expect([r1(2.345), r1(-0.06), r1(10)]).toEqual([2.3, -0.1, 10]);
    const copies = files('src').filter((f) => f !== 'src/words.ts' && f !== 'src/library/data.ts' && /Math\.round\([^)]*\* 10\) \/ 10/.test(readFileSync(f, 'utf8') as string));
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
