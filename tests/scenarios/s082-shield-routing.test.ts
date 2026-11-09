import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';

describe('82 Shield routing', () => {
  it('a block with a shield at gap 0 damages the shield pool and not the health track', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    // slime 80 + 15 + 10 − 63.5 = 41.5 → Great Success; player block (40 + 25 kit): 95 + 32.5 − 63.5 = 64 → Great Success
    const r = ruleset.attack({ attackerId: 'slime_1', targetId: 'player', weaponId: 'natural:slam', targetPart: null, aimed: false }, s, forcedRng([80, 95]));
    expect(r.defenseType).toBe('block');
    expect(r.gap).toBe(0);
    expect(r.outcome).toBe('blocked');
    expect(r.location).toBe('shield');
    expect(r.shieldItemId).toBe(`player_${IT.round_shield}_2`);
    const parts = { ...s.player.core.condition.parts };
    const fx = ruleset.applyEffects(r, s);
    const shield = s.player.core.inventory.find((i) => i.id === `player_${IT.round_shield}_2`)!;
    expect(shield.pools!.shield).toBeCloseTo(100 - (20 / 30) * 100); // slam 20 of a 30-point pool
    expect(s.player.core.condition.hpLostPct).toBe(0);
    expect(s.player.core.condition.parts).toEqual(parts);
    expect(fx).toEqual([{ kind: 'part_state_changed', actorId: 'player', data: { part: 'shield', from: 'Healthy', to: 'Damaged', itemId: `player_${IT.round_shield}_2` } }]);
  });
});
