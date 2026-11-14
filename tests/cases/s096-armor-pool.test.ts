import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

describe('96 Armor pool', () => {
  it('a head hit drains the helm pool before the head pool; the health track ignores the helm pool', () => {
    const s = makeVillage();
    const g = place(s, 'guard_1', 'tav_common');
    g.core.inventory = g.core.inventory.filter((i) => i.itemId !== IT.mail_hauberk);
    g.core.inventory.push({ id: 'plate', itemId: IT.plate_harness, equippedIn: ['armor'], pools: { head: 100 } });
    g.core.skills[SK.parry] = { raw: 30, state: 'normal' };
    g.core.skills[SK.endurance] = { raw: 0, state: 'normal' }; // pin HP at HP_BASE 50; the rank sheet gives the guard Endurance
    g.core.standingDefense = 'parry'; // the guard carries a shield too; this case is about parry
    // aimed head: 100 → Great Success + 1 = 2; guard parry 20 + 15 − 63.5 → Failure (-2): gap −4, 2×
    const r = ruleset.attack({ attackerId: 'player', targetId: 'guard_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: 'head', aimed: true }, s, forcedRng([100, 20]));
    expect(r.location).toBe('head');
    expect(r.damage).toBeCloseTo((50 - 6) * 0.55, 9); // 24.2, not rounded (OQ-25)
    ruleset.applyEffects(r, s);
    const plate = g.core.inventory.find((i) => i.id === 'plate')!;
    expect(plate.pools!.head).toBe(0); // the 20-point helm pool is drained
    // the other 4.2 reach the head: guard HP 50, head pool 10 → 58% left
    expect(g.core.condition.parts.head).toBeCloseTo(58);
    // health track: 4.2 × 1.5 (essential) of 50 HP = 12.6%
    expect(g.core.condition.hpLostPct).toBeCloseTo(12.6);
  });
});
