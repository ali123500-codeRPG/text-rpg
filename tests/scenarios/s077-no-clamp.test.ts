import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('77 No clamp', () => {
  it('Strong plus a natural 00 goes past Critical Success; the named tier is Critical Success', () => {
    const s = makeVillage();
    // 100 + 0.5×50 − 63.5 = 61.5 → Strong (4), natural 00 → +2
    const r = ruleset.roll({ actorId: 'player', skill: 'melee_medium', modifiers: [], tierShifts: [] }, s, forcedRng([100]));
    expect(r.margin).toBe(61.5);
    expect(r.natural).toBe(2);
    expect(r.tierIndex).toBe(6);
    expect(r.tier).toBe('Critical Success');
  });
});
