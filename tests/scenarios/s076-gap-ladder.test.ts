import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { bodyType } from '../../src/library';

const sword = `player_${IT.arming_sword}_1`;
describe('76 Gap ladder', () => {
  it('gap +1 against dodge gives 0.8×', () => {
    const s = makeVillage();
    // player 50 → Success (0); patron dodge 0: 95 − 63.5 = 31.5 → Great Success (1)
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false }, s, forcedRng([50, 95, 80]));
    expect(r.defenseType).toBe('dodge');
    expect(r.gap).toBe(1);
    expect(r.multiplier).toBe(0.8);
    expect(r.outcome).toBe('grazed');
    expect(r.damage).toBe(20); // 25 × 0.8, torso, no armor
  });
  it('gap 0 against block lands on a Non-essential part or the general area', () => {
    const s = makeVillage();
    place(s, 'guard_1', 'tav_common');
    // guard blocks with its sword: 60 + 0.5×30 − 63.5 = 11.5 → Success; location roll 5 = head
    const r = ruleset.attack({ attackerId: 'player', targetId: 'guard_1', weaponId: sword, targetPart: null, aimed: false }, s, forcedRng([50, 60, 5]));
    expect(r.defenseType).toBe('block');
    expect(r.gap).toBe(0);
    expect(r.multiplier).toBe(1);
    const parts = bodyType(s, 'humanoid').parts;
    expect(r.location === 'general' || parts.find((p) => p.id === r.location)?.impact === 'non_essential').toBe(true);
    expect(r.locationHow).toBe('restricted');
  });
});
