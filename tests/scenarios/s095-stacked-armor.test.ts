import { BT } from '../../src/library/raceIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng, fit } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';

describe('95 Stacked armor', () => {
  it('worn armor, then natural armor, floor 0, not rounded', () => {
    const s = makeVillage();
    // BR6: natural armor is on the race
    const scaled = { id: 'scaled_man', name: 'Scaled man', bodyTypeId: BT.humanoid, hpMultiplier: 1, intelligence: 'intelligent' as const, naturalArmor: { covers: ['general'], reduction: 2, multiplier: 0.5 } };
    getLibrary().races!.scaled_man = scaled;
    const t = s.actors.find((a) => a.id === 'patron_1')!;
    t.core.raceId = 'scaled_man';
    t.core.inventory.push({ id: 'gam', itemId: IT.gambeson, equippedIn: ['armor'] });
    fit(t, IT.gambeson);
    // player 50 → Success; patron dodge 0 − 5 (gambeson): 30 − 2.5 − 63.5 → Failure; gap −2; location 80 → general
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: null, aimed: false };
    const r = ruleset.attack(req, s, forcedRng([50, 30, 80]));
    expect(r.location).toBe('general');
    expect(r.damage).toBeCloseTo(((25 - 2) * 0.8 - 2) * 0.5, 9); // 8.2, fractions allowed (OQ-25)
    scaled.naturalArmor.reduction = 50;
    expect(ruleset.attack(req, s, forcedRng([50, 30, 80])).damage).toBe(0);
    delete getLibrary().races!.scaled_man;
  });
});
