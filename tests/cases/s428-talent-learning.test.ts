// 428 D-224 a: talent scales learning in play. An improvement roll gains with its plain chance × 1 ÷ the talent's
// training-years multiplier (Common ×3 learns at a third of the chance, Prodigy ×0.5 at twice it, never past every d100);
// how much a gaining roll gains keeps the plain roll's spread. The player has no talent (AG27), so nothing changes for them.
import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/types';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { growthRoll, payRolls, talentChance } from '../../src/ruleset/improve';
import { talentMult } from '../../src/ruleset/age';
import { TALENTS } from '../../src/scales';

const D = Array.from({ length: 100 }, (_, i) => i + 1);
const gains = (raw: number, chance: number) => D.map((d) => growthRoll(d, { raw, state: 'normal' }, 0, 0, chance).gain);
const odds = (raw: number, chance: number) => gains(raw, chance).filter(Boolean).length;

describe('428 talent and learning speed', () => {
  it('multiplies the chance a roll gains by 1 ÷ the talent multiplier, rounded, never past all 100', () => {
    for (const k of TALENTS.keys) {
      const c = 1 / talentMult(k);
      expect(odds(50, c)).toBe(Math.min(100, Math.round(50 * c)));
      expect(odds(90, c)).toBe(Math.min(100, Math.round(10 * c)));
    }
    expect(odds(50, 1 / CONFIG.TALENT_MULT.talent_0)).toBe(17); // Common: 50% → 17%
    expect(odds(50, 1 / CONFIG.TALENT_MULT.talent_4)).toBe(100); // Prodigy: 50% → every roll
    expect(odds(CONFIG.SKILL_CAP, 2)).toBe(0); // no chance stays no chance
  });

  it('keeps how much a gaining roll gains: the best die still gains the plain best, the least still gains 1', () => {
    for (const c of [1 / 3, 1 / 2, 4 / 3, 2]) {
      const g = gains(50, c).filter(Boolean);
      expect(Math.max(...g)).toBe(Math.max(...gains(50, 1)));
      expect(Math.min(...g)).toBe(1);
    }
    expect(gains(40, 1)).toEqual(D.map((d) => growthRoll(d, { raw: 40, state: 'normal' }, 0).gain)); // chance 1 is the plain roll
  });

  it('reads the character\'s talent; the player has none and rolls as before', () => {
    const s = makeVillage();
    expect(talentChance(s.player)).toBe(1);
    s.player.core.talent = 'talent_0';
    expect(talentChance(s.player)).toBeCloseTo(1 / CONFIG.TALENT_MULT.talent_0);
    s.player.core.skills[SK.dodge] = { raw: 50, state: 'normal' };
    const rng: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => 80 }; // plain: 80 + 50 − 100 = 30, +2
    expect(payRolls(s, rng, [[SK.dodge, 1]])).toEqual([]); // Common gains only on the top 17
    s.player.core.talent = 'talent_4';
    expect(payRolls(s, rng, [[SK.dodge, 1]])).toMatchObject([{ from: 50 }]); // Prodigy gains on every die
  });
});
