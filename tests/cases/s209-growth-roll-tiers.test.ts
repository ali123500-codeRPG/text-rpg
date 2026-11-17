// 209 Improvement roll read off the tier table (Skill Gain Roll Options, SG1 C): margin = d100 + (cap − raw − Burden) − 100
// (D-374 TB7); Success +2, Great Success +3, Critical Success +4; no hard limit: the roll runs out just past the cap (100, 120 tagged).
import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { growthRoll, payRolls, skillCap } from '../../src/ruleset/improve';

const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const odds = (raw: number, state: 'normal' | 'tagged' | 'flawed') => { let any = 0; for (let d = 1; d <= 100; d++) if (growthRoll(d, { raw, state }, 0).gain) any++; return any; };

describe('209 improvement roll on the tier table', () => {
  it('reads the gain off the tier: a miss 0, Success +2, Great +3, Critical +4', () => {
    const s = { raw: 50, state: 'normal' as const };
    expect(growthRoll(49, s, 0).gain).toBe(0); // margin −1: Near Miss
    expect(growthRoll(50, s, 0).gain).toBe(2); // margin 0: Success
    expect(growthRoll(75, s, 0).gain).toBe(3); // margin 25: Great Success
    expect(growthRoll(100, s, 0).gain).toBe(3); // margin 50
    expect(growthRoll(100, { raw: 0, state: 'normal' }, 0).gain).toBe(4); // margin 100: Critical Success
  });

  it('scales smoothly: 76% at 25, 51% at 50, 26% at 75, 2% at 99, and a tagged skill at 100 rolls like an untagged 80', () => {
    expect([25, 50, 75, 99].map((r) => odds(r, 'normal'))).toEqual([76, 51, 26, 2]);
    expect(odds(100, 'tagged')).toBe(odds(100 - CONFIG.TAG_CAP_BONUS, 'normal'));
    expect(odds(CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS - 1, 'tagged')).toBe(2);
  });

  it('Burden weighs on untagged skills only', () => {
    expect(growthRoll(55, { raw: 50, state: 'normal' }, 10).gain).toBe(0); // margin 55 + 50 − 10 − 100 = −5
    expect(growthRoll(55, { raw: 50, state: 'tagged' }, 10).gain).toBe(3); // margin 55 + 70 − 100 = 25, from the tagged cap 120
  });

  it('natural edges do not move the roll (SG2 lever off)', () => {
    expect(CONFIG.GROWTH_NATURAL_EDGES).toBe(false);
    expect(growthRoll(100, { raw: 99, state: 'normal' }, 0).gain).toBe(2); // margin 1: Success, not lifted to Great
    expect(growthRoll(3, { raw: 0, state: 'normal' }, 0).gain).toBe(2); // margin 3: Success, not dropped
  });

  it('no hard limit (D-374 TB7): at the cap only a natural 100 gains, one past it nothing, unless a bonus adds room', () => {
    expect(skillCap({ state: 'normal' })).toBe(CONFIG.SKILL_CAP);
    expect(skillCap({ state: 'tagged' })).toBe(CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS);
    expect(growthRoll(100, { raw: 100, state: 'normal' }, 0).gain).toBe(2); // margin 0: raw goes to 102
    expect(growthRoll(99, { raw: 100, state: 'normal' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 101, state: 'normal' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 120, state: 'tagged' }, 0).gain).toBe(2);
    expect(growthRoll(100, { raw: 105, state: 'normal' }, 0, undefined, 5).gain).toBe(2); // a group bonus of 5 carries it 5 further
  });

  it('a flawed skill\'s cap is 75 and in its roll; tags and flaws roll one die like any skill', () => {
    expect(skillCap({ state: 'flawed' })).toBe(CONFIG.SKILL_CAP - CONFIG.FLAW_CAP_PENALTY);
    expect(odds(50, 'flawed')).toBe(odds(75, 'normal')); // the room left counts from 75
    expect(growthRoll(100, { raw: 75, state: 'flawed' }, 0).gain).toBe(2);
    expect(growthRoll(100, { raw: 80, state: 'flawed' }, 0).gain).toBe(0); // past its cap the roll runs out
    const s = makeVillage();
    s.player.core.skills[SK.dodge] = { raw: 40, state: 'flawed' };
    let calls = 0;
    const rng: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => { calls++; return 100; } };
    expect(payRolls(s, rng, [[SK.dodge, 1]])).toMatchObject([{ from: 40, to: 43 }]); // one d100: 100 + (75 − 40) − 100 = 35, Great Success: +3
    expect(calls).toBe(1);
  });

  it('payRolls adds the tier gain until the roll runs out', () => {
    const s = makeVillage();
    const sk = { raw: 30, state: 'tagged' as const };
    s.player.core.skills = { [SK.dodge]: sk }; // alone: no tagged group-mate adds a bonus
    const gains = payRolls(s, dice(100), [[SK.dodge, 1]]); // margin 100 + 90 − 100 = 90: Critical Success
    expect(gains[0]).toMatchObject({ from: 30, to: 34 });
    sk.raw = 120;
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])[0]).toMatchObject({ from: 120, to: 122 });
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])).toEqual([]);
  });
});
