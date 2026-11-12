import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';

describe('77 No clamp', () => {
  it('Great Success plus a natural 00 goes past Critical Success; the named tier is Critical Success', () => {
    const s = makeVillage();
    // 100 + 0.5×50 − 63.5 = 61.5 → Great Success, natural 00 → two steps up, one past Critical Success
    const r = ruleset.roll({ actorId: 'player', skill: SK.melee_medium, modifiers: [], tierShifts: [] }, s, forcedRng([100]));
    expect(r.margin).toBe(61.5);
    expect(r.natural).toBe(2);
    expect(r.tier).toBe('critical_success');
    expect(r.beyond).toBe(1);
    expect(tierName(r)).toBe('Critical Success+');
  });
});
