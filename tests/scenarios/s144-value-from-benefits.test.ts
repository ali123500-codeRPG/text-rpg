// 144 Item value from benefits (SL12 b, SL13, SL14): an item's value is its benefit numbers in coin, summed.
// A stated bonus outside the requirement's skill counts (the basket-hilted sword's +5 Block), as do reach, armor,
// pools and roll bonuses (the lucky charm). Consumables and items with no benefit numbers keep their hand-set value.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { benefits, itemValue } from '../../src/ruleset/value';
import { effectiveSkill } from '../../src/ruleset/gear';
import { itemDef } from '../../src/library';
import { CONFIG } from '../../src/config';
import { reachLinks } from '../../src/ruleset/range';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

const V = CONFIG.ITEM_VALUE;
const val = (id: string) => itemValue(null, itemDef(null, id));

it('144a weapons: kit bonus plus reach', () => {
  expect(val(IT.arming_sword)).toBe(20 * V.skillPoint); // kit 0.4 × need 50
  expect(val(IT.shortbow)).toBe(10 * V.skillPoint + reachLinks(50) * V.reachZone); // range counts (SL14): 50 m in zone links
  expect(val(IT.dagger)).toBe(10 * V.skillPoint + reachLinks(1 + CONFIG.THROWN_REACH_M) * V.reachZone); // its throw: 1 m + THROWN_REACH_M zones
  expect(val(IT.cudgel)).toBe(1); // crude: worth 1 (SL13)
  expect(val(IT.improvised_medium)).toBe(0);
});

it('144b the basket-hilted sword: +5 Parry beyond its requirement adds to its value and to Parry', () => {
  expect(val(IT.basket_hilt_sword)).toBe(val(IT.arming_sword) + 5 * V.skillPoint);
  expect(benefits(itemDef(null, IT.basket_hilt_sword)).map((b) => b.what)).toContain('+5 skill bonus');
  const s = makeVillage();
  s.player.core.skills[SK.parry] = { raw: 30, marked: false } as never;
  const before = effectiveSkill(s, s.player, SK.parry).value;
  s.player.core.inventory.push({ id: 'bh', itemId: IT.basket_hilt_sword, equippedIn: ['hand:right'] } as never);
  expect(effectiveSkill(s, s.player, SK.parry).value).toBeGreaterThan(before);
});

it('144c armor, shields and the lucky charm are priced from their numbers', () => {
  const g = itemDef(null, IT.gambeson).armor!;
  expect(val(IT.gambeson)).toBe(Math.round((g.reduction * V.armorStop + (1 - g.multiplier) * 100 * V.armorCut) * g.covers.length));
  expect(val(IT.round_shield)).toBe(10 * V.skillPoint + itemDef(null, IT.round_shield).shield!.pool * V.poolPoint);
  expect(val(IT.lucky_charm)).toBe((5 / CONFIG.SKILL_WEIGHT) * V.skillPoint); // +5 to situation rolls
  expect(val(IT.crude_clothes)).toBe(1);
});

it('144d consumables and items with no benefit numbers keep their hand-set value', () => {
  for (const id of [IT.healing_draught, IT.bandage, IT.signet_ring, IT.curio, IT.coin]) expect(val(id)).toBe(itemDef(null, id).value);
});
