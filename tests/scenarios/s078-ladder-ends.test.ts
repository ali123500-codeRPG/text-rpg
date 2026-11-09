import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ladder, ruleset } from '../../src/ruleset';

describe('78 Ladder ends', () => {
  it('a gap of +6 or −6 uses the ±5 entry', () => {
    for (const t of ['dodge', 'block'] as const) {
      expect(ladder(t, 6)).toBe(ladder(t, 5));
      expect(ladder(t, -6)).toBe(ladder(t, -5));
    }
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // player 100: Great Success + 2 = 3; slime dodge 0: 3 − 63.5 → Failure (-2), natural −1 → -3. gap −6
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([100, 3, 50]));
    expect(r.gap).toBe(-6);
    expect(r.multiplier).toBe(2);
    expect(r.outcome).toBe('crushing_hit');
    expect(r.damage).toBe(50);
  });
});
