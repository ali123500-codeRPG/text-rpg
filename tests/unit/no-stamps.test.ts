// Code, comments and game text carry no decision stamps: no dates (day/month/year) and no attributions to the owner.
// Why a rule changed belongs in the PR and the decision log, not in the code. Quoted dates are test data and are allowed.
import { describe, expect, it } from 'vitest';
import { bannedLines } from '../harness/guard';

const ROOTS = ['src', 'tests', 'scripts'];
const DATE = /(?<!['"\d])\d{1,2}\/\d{1,2}\/20\d{2}(?!['"])/;
const ATTRIBUTION = /\bAli\b/; // any mention of the owner by name

describe('no decision stamps in code', () => {
  it('no file in src, tests or scripts has a date or attribution stamp', () => {
    expect(bannedLines(new RegExp(`${DATE.source}|${ATTRIBUTION.source}`), {}, ROOTS, /\.(ts|js|cjs|mjs|css|html)$/)).toEqual([]);
  });
});
