import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

// guard wears a mail hauberk (general area and arms) and blocks with its sword: 40 + 15 − 63.5 → Near Miss (-1)
describe('94 Uncovered part', () => {
  it('an aimed head hit takes no armor; a torso hit does', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    g.core.skills.block = { raw: 30, state: 'normal' }; // the numbers below assume the template minimum, before level points
    // aimed head: 95 + 37.5 − 30 − 63.5 = 39 → Great Success (1); gap −2
    const head = ruleset.attack({ attackerId: 'player', targetId: 'guard_1', weaponId: 'player_arming_sword_1', targetPart: 'head', aimed: true }, s, forcedRng([95, 40]));
    expect(head.gap).toBe(-2);
    expect(head.location).toBe('head');
    expect(head.damage).toBe(25);
    // torso: 65 + 37.5 − 63.5 = 39 → Great Success; location roll 80 → general
    const torso = ruleset.attack({ attackerId: 'player', targetId: 'guard_1', weaponId: 'player_arming_sword_1', targetPart: null, aimed: false }, s, forcedRng([65, 40, 80]));
    expect(torso.location).toBe('general');
    expect(torso.damage).toBeCloseTo((25 - 4) * 0.65, 9); // 13.65, not rounded (OQ-25)
  });
});
