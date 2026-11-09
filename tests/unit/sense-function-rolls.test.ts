// Ali (09/11/2026): a sight roll rolls the sight function, not one skill. Eyesight and Tremor are both sight skills,
// so the higher effective skill applies at full value (its tier multiplier still counts). The same goes for hearing.
import { describe, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { CONFIG } from '../../src/config';

const sense = (actorId: string, fn: 'sight' | 'hearing') => ({ actorId, skill: fn, fn, modifiers: [], tierShifts: [], auto: false as const });
const value = (r: { d100: number; margin: number }) => (r.margin - r.d100 + CONFIG.ROLL_NEEDED) / CONFIG.SKILL_WEIGHT;

describe('sense rolls use the function', () => {
  it('Tremor rolls sight and hearing at full value (tier 0 halves it) when it beats Eyesight and Earshot', () => {
    const s = makeVillage(), p = actor(s, 'slime_1');
    p.core.skills.tremor = { raw: 50, state: 'normal' };
    for (const fn of ['sight', 'hearing'] as const) {
      const r = ruleset.roll(sense(p.id, fn), s, createRng(1));
      expect(r.skill).toBe('tremor');
      expect(value(r)).toBeCloseTo(25);
      expect(r.asked).toBeUndefined();
    }
  });
  it('a slime has no eyes, so Eyesight never counts for it; a human rolls Eyesight and Earshot', () => {
    const s = makeVillage(), slime = actor(s, 'slime_1'), p = s.player;
    slime.core.skills.tremor = { raw: 50, state: 'normal' };
    slime.core.skills.sight = { raw: 40, state: 'normal' };
    expect(ruleset.roll(sense(slime.id, 'sight'), s, createRng(1)).skill).toBe('tremor');
    p.core.skills.sight = { raw: 40, state: 'normal' };
    p.core.skills.hearing = { raw: 10, state: 'normal' };
    const sight = ruleset.roll(sense(p.id, 'sight'), s, createRng(1)), hearing = ruleset.roll(sense(p.id, 'hearing'), s, createRng(1));
    expect([sight.skill, value(sight)]).toEqual(['sight', 40]);
    expect(hearing.skill).toBe('hearing');
  });
});
