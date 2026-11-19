// 144 Item value from benefits (SL12 b, SL13, SL14, IR4): an item's value is its benefit numbers in coin, summed;
// a weapon's damage counts as damage a second.
// A stated bonus outside the requirement's skill counts (a special piece's extra, IR33: a +5 Parry stand-in), as do reach, armor,
// pools and roll bonuses (the lucky charm). Consumables and items with no benefit numbers keep their hand-set value.
import { afterEach, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { benefits, itemValue, modeDps } from '../../src/ruleset/value';
import { actionRow, actionSeconds } from '../../src/ruleset/actionTime';
import { DU } from '../../src/library/tableIds';
import { effectiveSkill } from '../../src/ruleset/gear';
import { getLibrary, itemDef, resetLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { damageGrowth } from '../../src/library/gearScale';

afterEach(() => resetLibrary());

const V = CONFIG.ITEM_VALUE;
const val = (id: string) => itemValue(null, itemDef(null, id));

it('144a weapons: kit bonus, damage a second and reach', () => {
  // IR4: damage a second, the class's damage grown with the item's need (the damage step's own growth)
  const dps = (cls: string, row: string, need: number) => ((CONFIG.WEAPON_CLASSES[cls].damage * damageGrowth(need)) / actionSeconds(actionRow(row)!)) * V.dps;
  expect(val(IT.arming_sword)).toBe(Math.round(20 * V.skillPoint + dps('medium', DU.blow_medium, 50) + 1.6 * V.reachM)); // kit 0.4 × need 50
  expect(val(IT.shortbow)).toBe(Math.round(10 * V.skillPoint + dps('light', DU.bow_light, 25) + 50 * V.reachRangedM)); // a bow's range at its own rate
  expect(val(IT.dagger)).toBe(Math.round(10 * V.skillPoint + dps('light', DU.blow, 25) + CONFIG.THROW_M.knife * V.reachM)); // its throw: 7 m
  expect(modeDps(itemDef(null, IT.dagger), itemDef(null, IT.dagger).weapon!.modes[0])).toBeCloseTo((20 * 1.25) / 3); // light: 20 damage × 1.25 (need 25), a 3 s blow
  expect(val(IT.improvised_medium)).toBe(0);
});

it('144b a stated bonus beyond the requirement (+5 Parry on a stand-in) adds to its value and to Parry', () => {
  const s = makeVillage();
  expect(val(IT.basket_hilt_sword)).toBe(val(IT.arming_sword)); // Mundane (IR31): priced as any Fine sword
  const d = getLibrary().items[IT.basket_hilt_sword]; // a special piece's extra (IR33), on a stand-in
  d.effects = [...(d.effects ?? []), { kind: 'skill', skill: SK.parry, value: 5, active: 'held', scope: 'any' }];
  expect(val(IT.basket_hilt_sword)).toBe(val(IT.arming_sword) + 5 * V.skillPoint);
  expect(benefits(itemDef(null, IT.basket_hilt_sword)).map((b) => b.what)).toContain('+5 skill bonus');
  s.player.core.skills[SK.parry] = { raw: 30, marked: false } as never;
  const before = effectiveSkill(s, s.player, SK.parry).value;
  s.player.core.inventory.push({ id: 'bh', itemId: IT.basket_hilt_sword, equippedIn: ['grip:right'] } as never);
  expect(effectiveSkill(s, s.player, SK.parry).value).toBeGreaterThan(before);
});

it('144c armor, shields and the lucky charm are priced from their numbers', () => {
  const g = itemDef(null, IT.gambeson).armor!;
  expect(val(IT.gambeson)).toBe(Math.round((g.reduction * V.armorStop + (1 - g.multiplier) * 100 * V.armorCut) * g.covers.length));
  expect(val(IT.round_shield)).toBe(10 * V.skillPoint + itemDef(null, IT.round_shield).shield!.pool * V.poolPoint);
  expect(val(IT.lucky_charm)).toBe((5 / CONFIG.SKILL_WEIGHT) * V.skillPoint); // +5 to event rolls
  expect(val(IT.crude_clothes)).toBe(1);
});

it('144d consumables and items with no benefit numbers keep their hand-set value', () => {
  for (const id of [IT.healing_draught, IT.bandage, IT.curio, IT.coin]) expect(val(id)).toBe(itemDef(null, id).value);
});
