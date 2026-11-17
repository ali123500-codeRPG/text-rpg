// 209 Improvement roll (SG1 C): margin = d100 + (cap − raw − Burden) − 100 (D-374 TB7); gain = margin ÷ 15, rounded up, nothing
// at 0 or below (D-378), so raw stops exactly where the roll runs out (100, 120 tagged).
import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { growthRoll, payRolls, skillCap } from '../../src/ruleset/improve';

const dice = (...d: number[]): Rng => { let i = 0; return { state: 1, next: () => 0, int: (lo) => lo, d100: () => d[Math.min(i++, d.length - 1)] }; };
const odds = (raw: number, state: 'normal' | 'tagged' | 'flawed') => { let any = 0; for (let d = 1; d <= 100; d++) if (growthRoll(d, { raw, state }, 0).gain) any++; return any; };

describe('209 improvement roll', () => {
  it('gains margin ÷ GROWTH_MARGIN_PER_POINT, rounded up; nothing at margin 0 or below', () => {
    const s = { raw: 50, state: 'normal' as const };
    expect(growthRoll(50, s, 0).gain).toBe(0); // margin 0
    expect(growthRoll(51, s, 0).gain).toBe(1); // margin 1
    expect(growthRoll(65, s, 0).gain).toBe(1); // margin 15
    expect(growthRoll(66, s, 0).gain).toBe(2); // margin 16
    expect(growthRoll(100, s, 0).gain).toBe(Math.ceil(50 / CONFIG.GROWTH_MARGIN_PER_POINT)); // margin 50: 4
    expect(growthRoll(100, { raw: 0, state: 'normal' }, 0).gain).toBe(7); // margin 100
  });

  it('scales smoothly: 75% at 25, 50% at 50, 25% at 75, 1% at 99, and a tagged skill at 100 rolls like an untagged 80', () => {
    expect([25, 50, 75, 99].map((r) => odds(r, 'normal'))).toEqual([75, 50, 25, 1]);
    expect(odds(100, 'tagged')).toBe(odds(100 - CONFIG.TAG_CAP_BONUS, 'normal'));
    expect(odds(CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS - 1, 'tagged')).toBe(1);
  });

  it('Burden weighs on untagged skills only', () => {
    expect(growthRoll(55, { raw: 50, state: 'normal' }, 10).gain).toBe(0); // margin 55 + 50 − 10 − 100 = −5
    expect(growthRoll(55, { raw: 50, state: 'tagged' }, 10).gain).toBe(2); // margin 55 + 70 − 100 = 25, from the tagged cap 120
  });

  it('raw stops exactly at the cap: a natural 100 there gains nothing, unless a group bonus adds room', () => {
    expect(skillCap({ state: 'normal' })).toBe(CONFIG.SKILL_CAP);
    expect(skillCap({ state: 'tagged' })).toBe(CONFIG.SKILL_CAP + CONFIG.TAG_CAP_BONUS);
    expect(growthRoll(100, { raw: 99, state: 'normal' }, 0).gain).toBe(1); // margin 1: raw goes to 100
    expect(growthRoll(100, { raw: 100, state: 'normal' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 119, state: 'tagged' }, 0).gain).toBe(1);
    expect(growthRoll(100, { raw: 120, state: 'tagged' }, 0).gain).toBe(0);
    expect(growthRoll(100, { raw: 104, state: 'normal' }, 0, 5).gain).toBe(1); // a group bonus of 5 carries it to 105
    expect(growthRoll(100, { raw: 105, state: 'normal' }, 0, 5).gain).toBe(0);
  });

  it('a flawed skill\'s cap is 75 and in its roll; tags and flaws roll one die like any skill', () => {
    expect(skillCap({ state: 'flawed' })).toBe(CONFIG.SKILL_CAP - CONFIG.FLAW_CAP_PENALTY);
    expect(odds(50, 'flawed')).toBe(odds(75, 'normal')); // the room left counts from 75
    expect(growthRoll(100, { raw: 74, state: 'flawed' }, 0).gain).toBe(1);
    expect(growthRoll(100, { raw: 75, state: 'flawed' }, 0).gain).toBe(0);
    const s = makeVillage();
    s.player.core.skills[SK.dodge] = { raw: 40, state: 'flawed' };
    let calls = 0;
    const rng: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => { calls++; return 100; } };
    expect(payRolls(s, rng, [[SK.dodge, 1]])).toMatchObject([{ from: 40, to: 43 }]); // one d100: 100 + (75 − 40) − 100 = 35: +3
    expect(calls).toBe(1);
  });

  it('payRolls adds the gain until the roll runs out', () => {
    const s = makeVillage();
    const sk = { raw: 30, state: 'tagged' as const };
    s.player.core.skills = { [SK.dodge]: sk }; // alone: no tagged group-mate adds a bonus
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])[0]).toMatchObject({ from: 30, to: 36 }); // margin 100 + 90 − 100 = 90: +6
    sk.raw = 119;
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])[0]).toMatchObject({ from: 119, to: 120 });
    expect(payRolls(s, dice(100), [[SK.dodge, 1]])).toEqual([]);
  });
});
