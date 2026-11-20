// The config split (Phase 2, SX5 and SX7): CONFIG built from src/config/ parts must equal the single DEFAULTS literal it
// replaced, key for key and in the same order, and stay one shared, writable object that resetConfig puts back.
// tests/fixtures/config-before-split.json was written from the old file before the move. This file and the fixture are a
// one-time check: the PR after the split removes them, so tuning a value later does not trip it.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { CONFIG, resetConfig } from '../../src/config';
import { timeFactor } from '../../src/ruleset/actionTime';

const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? `__num:${x}` : x === undefined ? '__undefined__' : x));
const before = JSON.parse(readFileSync('tests/fixtures/config-before-split.json', 'utf8')) as { keys: string[]; values: string };

describe('config split', () => {
  it('has every key, in the same order, with the same value', () => {
    resetConfig();
    expect(Object.keys(CONFIG)).toEqual(before.keys);
    expect(ser(CONFIG)).toBe(before.values);
  });

  it('is one shared, writable CONFIG that resetConfig restores', () => {
    const was = CONFIG.SNEAK_TIME_MULT;
    CONFIG.SNEAK_TIME_MULT = was + 1;
    expect(timeFactor({ posture: 'stealthy' } as never)).toBe(was + 1); // another module reads the change at call time
    resetConfig();
    expect(timeFactor({ posture: 'stealthy' } as never)).toBe(was);
  });
});
