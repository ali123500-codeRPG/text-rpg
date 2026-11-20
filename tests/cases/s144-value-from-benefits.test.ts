// 144 Item value from benefits (SL12 b, SL13, SL14, IR4): an item's value is its benefit numbers in coin, summed;
// a weapon's damage counts as damage a second.
// A stated bonus outside the requirement's skill counts (a special piece's extra, IR33: a +5 Parry stand-in), as do reach, armor,
// pools and roll bonuses (the lucky charm). Consumables and items with no benefit numbers keep their hand-set value.
import { afterEach, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { benefits, itemValue } from '../../src/ruleset/value';
import { effectiveSkill } from '../../src/ruleset/gear';
import { getLibrary, itemDef, resetLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';

afterEach(() => resetLibrary());

const V = CONFIG.ITEM_VALUE;
const val = (id: string) => itemValue(null, itemDef(null, id));

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

it('144d consumables and items with no benefit numbers keep their hand-set value', () => {
  for (const id of [IT.healing_draught, IT.bandage, IT.curio, IT.coin]) expect(val(id)).toBe(itemDef(null, id).value);
});
