// CS1: health levels and body-part states are keyed scales. Code compares keys or positions; display names live only
// in scales.ts, so renaming a level edits one table.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';
import { CONFIG } from '../../src/config';
import { HEALTH_LEVELS, PART_STATES } from '../../src/scales';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n: string) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) ? [p] : [];
  });
}

describe('health levels and part states by key', () => {
  it('the health track has one row per health level, in the scale order', () => {
    expect(CONFIG.HEALTH_TRACK.map(([l]) => l)).toEqual(HEALTH_LEVELS.keys);
  });
  it('no source file quotes a health level or part state by its display name', () => {
    const names = [...HEALTH_LEVELS.keys.map(HEALTH_LEVELS.name), ...PART_STATES.keys.map(PART_STATES.name)];
    const quoted = new RegExp(`(['"\`])(${names.join('|')})\\1`);
    const hits = files('src').filter((f) => !f.replace(/\\/g, '/').endsWith('src/scales.ts')).flatMap((f) => readFileSync(f, 'utf8').split('\n')
      .map((line: string, i: number) => (quoted.test(line) ? `${f}:${i + 1}: ${line.trim().slice(0, 100)}` : '')).filter(Boolean));
    expect(hits).toEqual([]);
  });
});
