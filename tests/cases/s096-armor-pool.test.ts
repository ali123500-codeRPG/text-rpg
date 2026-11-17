import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { getLibrary, itemDef, resetLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

afterEach(() => resetLibrary());

describe('96 Armor pool', () => {
  it('a head hit drains the helm pool before the head pool; the health track ignores the helm pool', () => {
    const s = makeVillage();
    // no Mundane piece carries a helm pool (IR31: nothing set by hand); a special piece may, so the rule is tested on a stand-in
    getLibrary().items[IT.plate_harness].armor!.pools = { head: 10 };
    const g = place(s, 'guard_1', 'tav_common');
    g.core.inventory = g.core.inventory.filter((i) => !itemDef(null, i.itemId).armor); // no hauberk or helmet: the harness covers both (IR19)
    g.core.inventory.push({ id: 'plate', itemId: IT.plate_harness, equippedIn: ['armor'], pools: { head: 100 } });
    g.core.skills[SK.parry] = { raw: 30, state: 'normal' };
    g.core.skills[SK.endurance] = { raw: 0, state: 'normal' }; // pin HP at HP_BASE 50; the rank sheet gives the guard Endurance
    g.core.perks = g.core.perks.filter((p) => p.source !== 'level'); // the guard's level perks would move the numbers; this case is about the pools
    g.core.standingDefense = 'parry'; // the guard carries a shield too; this case is about parry
    // aimed head: 100 → Great Success + 1 = 2; guard parry 20 + 15 − 63.5 → Failure (-2): gap −4, 2×
    const r = ruleset.attack({ attackerId: 'player', targetId: 'guard_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: 'head', aimed: true }, s, forcedRng([100, 20]));
    expect(r.location).toBe('head');
    expect(r.damage).toBeCloseTo(50 * 0.55 - 12, 9); // D-366: share first, then Superior plate's soak 6 × 2; 15.5, not rounded (OQ-25)
    ruleset.applyEffects(r, s);
    const plate = g.core.inventory.find((i) => i.id === 'plate')!;
    expect(plate.pools!.head).toBe(0); // the 10-point helm pool is drained
    // the other 5.5 reach the head: guard HP 50, head pool 10 → 45% left
    expect(g.core.condition.parts.head).toBeCloseTo(45);
    // health track: 5.5 × 1.5 (essential) of 50 HP = 16.5%
    expect(g.core.condition.hpLostPct).toBeCloseTo(16.5);
  });
});
