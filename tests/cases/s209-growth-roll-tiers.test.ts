// 209 Improvement roll read off the tier table (Skill Gain Roll Options, SG1 C): margin = d100 + (cap − raw − Burden) − 90;
// Success +3, Great Success +4, Critical Success +5; raw never passes its cap (100, or 125 tagged).
import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { growthRoll, payRolls, skillCap } from '../../src/ruleset/improve';

const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const odds = (raw: number, state: 'normal' | 'tagged' | 'flawed') => { let any = 0; for (let d = 1; d <= 100; d++) if (growthRoll(d, { raw, state }, 0).gain) any++; return any; };

describe('209 improvement roll on the tier table', () => {
  it('reads the gain off the tier: a miss 0, Success +3, Great +4, Critical +5', () => {
    const s = { raw: 50, state: 'normal' as const };
    expect(growthRoll(39, s, 0).gain).toBe(0); // margin −1: Near Miss
    expect(growthRoll(40, s, 0).gain).toBe(3); // margin 0: Success
    expect(growthRoll(65, s, 0).gain).toBe(4); // margin 25: Great Success
    expect(growthRoll(100, s, 0).gain).toBe(4); // margin 60
    expect(growthRoll(100, { raw: 10, state: 'normal' }, 0).gain).toBe(5); // margin 100: Critical Success
  });

  it('scales smoothly: 86% at 25, 61% at 50, 36% at 75, 12% at 99, and a tagged skill at 100 rolls like an untagged 75', () => {
    expect([25, 50, 75, 99].map((r) => odds(r, 'normal'))).toEqual([86, 61, 36, 12]);
    expect(odds(100, 'tagged')).toBe(odds(75, 'normal'));
    expect(odds(124, 'tagged')).toBe(12);
  });

  it('Burden weighs on untagged skills only', () => {
    expect(growthRoll(45, { raw: 50, state: 'normal' }, 10).gain).toBe(0);
    expect(growthRoll(45, { raw: 50, state: 'tagged' }, 10).gain).toBe(4); // margin 45 + 75 − 90 = 30, from the tagged cap 125
  });

  it('natural edges do not move the roll (SG2 lever off)', () => {
    expect(CONFIG.GROWTH_NATURAL_EDGES).toBe(false);
    expect(growthRoll(100, { raw: 99, state: 'normal' }, 0).gain).toBe(1); // margin 11: Success, not lifted to Great
    expect(growthRoll(3, { raw: 0, state: 'normal' }, 0).gain).toBe(3); // margin 13: Success, not dropped
  });

  it('raw never passes its cap: 100, or 125 for a tagged skill', () => {
    expect(skillCap({ state: 'normal' })).toBe(CONFIG.SKILL_CAP);
    expect(skillCap({ state: 'tagged' })).toBe(CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS);
    expect(growthRoll(100, { raw: 99, state: 'normal' }, 0).gain).toBe(1);
    expect(growthRoll(100, { raw: 100, state: 'normal' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 124, state: 'tagged' }, 0).gain).toBe(1);
  });

  it('a flawed skill caps at 75 and the cap is in its roll; tags and flaws roll one die like any skill', () => {
    expect(skillCap({ state: 'flawed' })).toBe(CONFIG.SKILL_CAP - CONFIG.FLAW_CAP_PENALTY);
    expect(odds(50, 'flawed')).toBe(odds(75, 'normal')); // the room left counts from 75
    expect(growthRoll(100, { raw: 74, state: 'flawed' }, 0).gain).toBe(1);
    expect(growthRoll(100, { raw: 75, state: 'flawed' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 80, state: 'flawed' }, 0).gain).toBe(0); // flawed above its cap: keeps its raw, gains nothing
    const s = makeVillage();
    s.player.core.skills[SK.dodge] = { raw: 40, state: 'flawed' };
    let calls = 0;
    const rng: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => { calls++; return 100; } };
    expect(payRolls(s, rng, [[SK.dodge, 1]])).toMatchObject([{ from: 40, to: 44 }]); // one d100: 100 + (75 − 40) − 90 = 45, Great Success: +4
    expect(calls).toBe(1);
  });

  it('payRolls adds the tier gain and stops at the cap', () => {
    const s = makeVillage();
    const sk = s.player.core.skills[SK.dodge] ?? (s.player.core.skills[SK.dodge] = { raw: 0, state: 'normal' });
    sk.raw = 30; sk.state = 'tagged';
    const gains = payRolls(s, dice(100), [[SK.dodge, 1]]); // margin 100 + 95 − 90 = 105: Critical Success
    expect(gains[0]).toMatchObject({ from: 30, to: 35 });
    sk.raw = 124;
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])[0]).toMatchObject({ from: 124, to: 125 });
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])).toEqual([]);
  });
});
