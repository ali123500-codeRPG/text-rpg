import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ladder, ruleset } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';

describe('78 Ladder ends', () => {
  it('a gap past +5 uses the +5 entry; past −10 each step adds GAP_PAST_STEP with no top (CS10); −6 has its own row', () => {
    for (const t of ['dodge', 'block', 'parry'] as const) {
      expect(ladder(t, 6)).toBe(ladder(t, 5));
      expect(ladder(t, -11)).toBe(ladder(t, -10) + CONFIG.GAP_PAST_STEP);
      expect(ladder(t, -20)).toBe(ladder(t, -10) + 10 * CONFIG.GAP_PAST_STEP);
      expect(ladder(t, -6)).toBeGreaterThan(ladder(t, -5));
    }
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // player melee 60 + 20 kit, 100: 100 + 40 − 63.5 = 76.5 → Critical Success + 1 = 3; slime dodge 0: 3 − 63.5 → Failure (-2), natural −1 → -3. gap −6
    s.player.core.skills[SK.melee_medium].raw = 60;
    const r = ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false }, s, forcedRng([100, 3, 50]));
    expect(r.gap).toBe(-6);
    expect(r.multiplier).toBe(CONFIG.GAP_LADDER.dodge[-6]);
    expect(r.outcome).toBe('crushing_hit');
    expect(r.damage).toBe(25 * CONFIG.GAP_LADDER.dodge[-6]);
  });
});
