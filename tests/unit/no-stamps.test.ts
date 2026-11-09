// Code, comments and game text carry no decision stamps: no dates (day/month/year) and no attributions to the owner.
// Why a rule changed belongs in the PR and the decision log, not in the code. Quoted dates are test data and are allowed.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { join } from 'node:path';

const ROOTS = ['src', 'tests', 'scripts'];
const DATE = /(?<!['"\d])\d{1,2}\/\d{1,2}\/20\d{2}(?!['"])/;
const ATTRIBUTION = /\(Ali\)|\(Ali[,:]|\bAli:|\bAli,\s*\d/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n: string) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|js|cjs|mjs|css|html)$/.test(n) ? [p] : [];
  });
}

describe('no decision stamps in code', () => {
  it('no file in src, tests or scripts has a date or attribution stamp', () => {
    const hits = ROOTS.flatMap(files).flatMap((f) => readFileSync(f, 'utf8').split('\n')
      .map((line: string, i: number) => (DATE.test(line) || ATTRIBUTION.test(line) ? `${f}:${i + 1}: ${line.trim().slice(0, 100)}` : ''))
      .filter(Boolean));
    expect(hits).toEqual([]);
  });
});
