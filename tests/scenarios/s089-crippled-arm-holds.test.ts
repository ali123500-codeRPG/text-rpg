import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { hitTable, ruleset } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';

describe('89 Crippled arm holds', () => {
  it('a Crippled shield arm keeps the shield, offers no block, and leaves the hit table alone', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    delete s.player.core.inventory.find((i) => i.itemId === IT.arming_sword)!.equippedIn; // only the shield is held
    const table = hitTable(s, s.player);
    s.player.core.condition.parts.left_arm = -10; // Crippled
    const shield = s.player.core.inventory.find((i) => i.itemId === IT.round_shield)!;
    const r = ruleset.attack({ attackerId: 'slime_1', targetId: 'player', weaponId: 'natural:slam', targetPart: null, aimed: false }, s, forcedRng([80, 50, 80]));
    expect(r.defenseType).toBe('dodge');
    expect(shield.equippedIn).toEqual(['hand:left_arm']);
    expect(hitTable(s, s.player)).toEqual(table);
  });
});
