import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, tierName } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';

describe('77 No clamp', () => {
  it('Critical Success plus a natural 00 goes one past Critical Success; the named tier is Critical Success+', () => {
    const s = makeVillage();
    s.player.core.skills[SK.melee_medium].raw = 80;
    // 100 + 0.5×80 − 63.5 = 76.5 → Critical Success, natural 00 → one step up (never two), one past Critical Success
    const r = ruleset.roll({ actorId: 'player', skill: SK.melee_medium, modifiers: [], tierShifts: [] }, s, forcedRng([100]));
    expect(r.margin).toBe(76.5);
    expect(r.natural).toBe(1);
    expect(r.tier).toBe('critical_success');
    expect(r.beyond).toBe(1);
    expect(tierName(r)).toBe('Critical Success+');
  });
});
