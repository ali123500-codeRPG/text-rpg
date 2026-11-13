// BG-176 (runs 81c t34-40, 97c): the purse read "coin ×16" in /inv and in the gear line the agents read, so a player kept
// trying to pay four silver it did not have. One rule: an item's count reads through countWords, which says coin in coin words.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildNarrationView } from '../../src/views';
import { coinWords, countWords } from '../../src/engine/trade';
import { IT } from '../../src/library/itemIds';

it('coin reads in coin words wherever a count is printed', () => {
  expect(countWords(IT.coin, 'coin', 16)).toBe(coinWords(16));
  expect(countWords(IT.bandage, 'bandage', 3)).toBe('bandage ×3');
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== IT.coin);
  s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 16 });
  const gear = (buildNarrationView(s, []).player.gear ?? []).join('; ');
  expect(gear).toContain(coinWords(16));
  expect(gear).not.toContain('×16');
});
