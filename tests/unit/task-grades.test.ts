import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { GRADE_LEVELS } from '../../src/scales';
import { gradeMod } from '../../src/engine/resolve';

describe('task grades (CR4, CR12)', () => {
  it('DIFFICULTY climbs past extreme to the supernatural rows, in order', () => {
    const v = Object.values(CONFIG.DIFFICULTY);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(Object.keys(CONFIG.DIFFICULTY)).toEqual([...GRADE_LEVELS.keys]); // CS8: one grades table sets the order
  });
  it('SE23: a grade moves a solo roll by half a point per grade point, so a task at your own grade plays the same at every level', () => {
    expect(gradeMod(CONFIG.DIFFICULTY.moderate)).toBe(0);
    expect(gradeMod(CONFIG.DIFFICULTY.extreme)).toBe(-15);
    expect(gradeMod(CONFIG.DIFFICULTY.divine)).toBe(-175);
    const net = (skill: number) => CONFIG.SKILL_WEIGHT * skill + gradeMod(skill);
    for (const s of [CONFIG.DIFFICULTY.mortal_limit, CONFIG.DIFFICULTY.mythic, CONFIG.DIFFICULTY.divine]) expect(net(s)).toBe(net(CONFIG.DIFFICULTY.moderate));
  });
});
