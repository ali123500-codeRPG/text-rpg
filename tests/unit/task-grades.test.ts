import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { GRADES } from '../../src/types';
import { GRADE_LEVELS, WEAVER_GRADE_TOP } from '../../src/scales';
import { gradeMod } from '../../src/engine/resolve';

describe('task grades (CR4, CR12)', () => {
  it('DIFFICULTY climbs past extreme to the supernatural rows, in order', () => {
    const v = Object.values(CONFIG.DIFFICULTY);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(Object.keys(CONFIG.DIFFICULTY)).toEqual([...GRADE_LEVELS.keys]); // CS8: one grades table sets the order
    expect(GRADE_LEVELS.keys.slice(GRADES.length)).toEqual(['mortal_limit', 'beyond', 'mythic', 'divine']);
  });
  it('every build-spec line that lists the grades past extreme gives the numbers in DIFFICULTY (Divine 300 was left in Layer 2 after PR #792)', () => {
    const spec = readFileSync('docs/build-spec.md', 'utf8') as string;
    const lines = spec.split('\n').filter((l) => /mortal limit \d+/i.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const k of GRADE_LEVELS.keys.slice(GRADES.length)) {
      const re = new RegExp(`\\b${GRADE_LEVELS.name(k)} (\\d+)`, 'gi');
      for (const l of lines) for (const m of l.matchAll(re)) expect(`${GRADE_LEVELS.name(k)} ${m[1]}`).toBe(`${GRADE_LEVELS.name(k)} ${CONFIG.DIFFICULTY[k]}`);
    }
  });
  it('the rows past extreme are task grades only: the Weaver, gains and locks keep none to extreme', () => {
    expect(Object.keys(CONFIG.DIFFICULTY).slice(0, GRADES.length)).toEqual([...GRADES]);
    expect(GRADES.at(-1)).toBe(WEAVER_GRADE_TOP);
  });
  it('SE23: a grade moves a solo roll by half a point per grade point, so a task at your own grade plays the same at every level', () => {
    expect(gradeMod(CONFIG.DIFFICULTY.moderate)).toBe(0);
    expect(gradeMod(CONFIG.DIFFICULTY.extreme)).toBe(-15);
    expect(gradeMod(CONFIG.DIFFICULTY.divine)).toBe(-175);
    const net = (skill: number) => CONFIG.SKILL_WEIGHT * skill + gradeMod(skill);
    for (const s of [CONFIG.DIFFICULTY.mortal_limit, CONFIG.DIFFICULTY.mythic, CONFIG.DIFFICULTY.divine]) expect(net(s)).toBe(net(CONFIG.DIFFICULTY.moderate));
  });
});
