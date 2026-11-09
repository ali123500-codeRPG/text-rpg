import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('81 Forbidden part', () => {
  it('an aimed head attack against a dodge tie lands in the general area', () => {
    const s = makeVillage();
    // player 90 + 37.5 − 30 (aim, small) − 63.5 = 34 → Great Success; patron 90 − 63.5 = 26.5 → Great Success
    const r = ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: 'head', aimed: true }, s, forcedRng([90, 90]));
    expect(r.attack.modifiers).toContainEqual({ source: 'aim: head', type: 'aim', value: -30 });
    expect(r.defenseType).toBe('dodge');
    expect(r.gap).toBe(0);
    expect(r.location).toBe('general');
    expect(r.locationHow).toBe('restricted');
  });
});
