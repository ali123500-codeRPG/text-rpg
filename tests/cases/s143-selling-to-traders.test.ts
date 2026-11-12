// 143 Selling to traders (D-93, SL1–SL11): a Trader buys the kinds it sells at half the item's value, from its own
// purse; the item joins its stock; worn gear must come off first; haggling and Hard Bargain raise what it pays;
// a minted item's value grows with its quality.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { coins, itemValue, sell, sellPrice } from '../../src/engine/trade';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import type { GameState } from '../../src/types';

const SWORD = `player_${IT.arming_sword}_1`;
const GAMBESON = `player_${IT.gambeson}_3`;

function shop(): GameState {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const mags = actorById(s, 'trader')!;
  mags.wares = { items: [IT.dagger, IT.bandage], services: [] }; // buys weapons and consumables
  mags.core.inventory.push({ id: 'mags_purse', itemId: IT.coin, qty: CONFIG.TRADER_PURSE });
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== IT.coin);
  return s;
}

it('143a offers, a sale, and the item joining the stock', () => {
  const s = shop();
  const mags = actorById(s, 'trader')!;
  const offers = buildPlayerView(s).actors.find((a) => a.id === 'trader')!.offers!;
  expect(offers.find((o) => o.id === SWORD)?.price).toBe('1 silver'); // value 20 × 0.5
  expect(offers.some((o) => o.id === GAMBESON)).toBe(false); // armor: not a kind Mags sells
  const ev = play(s, { intent: intent({ action: { type: 'sell', target: 'trader', item: SWORD } }) });
  const e = ev.find((x) => x.kind === 'sell')!;
  expect(buildNarrationView(s, [e]).events[0]).toMatchObject({ item: 'arming sword', price: '1 silver' });
  expect(coins(s.player)).toBe(10);
  expect(coins(mags)).toBe(CONFIG.TRADER_PURSE - 10);
  const sword = mags.core.inventory.find((i) => i.id === SWORD)!;
  expect(sword.equippedIn).toBeUndefined(); // a held weapon is stowed and sold
  expect(mags.wares!.items).toContain(IT.arming_sword); // SL6: it can be bought back
});

it('143b refusals: worn gear, worthless items, an empty purse', () => {
  const s = shop();
  const mags = actorById(s, 'trader')!;
  mags.wares!.items.push(IT.gambeson);
  expect(sell(s, s.player, mags, GAMBESON, 1)).toEqual({ ok: false, reason: 'worn' });
  s.player.core.inventory.push({ id: 'chair', itemId: IT.improvised_light });
  expect(sell(s, s.player, mags, 'chair', 1)).toEqual({ ok: false, reason: 'not_bought' });
  mags.core.inventory.find((i) => i.id === 'mags_purse')!.qty = 3;
  expect(sell(s, s.player, mags, SWORD, 1)).toEqual({ ok: false, reason: 'not_enough_coin' });
  expect(s.player.core.inventory.some((i) => i.id === SWORD)).toBe(true);
});

it('143c a stack sells in part; haggling and Hard Bargain raise the price', () => {
  const s = shop();
  const mags = actorById(s, 'trader')!;
  s.player.core.inventory.push({ id: 'rolls', itemId: IT.bandage, qty: 4 });
  expect(sell(s, s.player, mags, 'rolls', 3)).toMatchObject({ ok: true, price: 3, qty: 3 }); // value 2 × 0.5 = 1 each
  expect(s.player.core.inventory.find((i) => i.id === 'rolls')!.qty).toBe(1);
  s.player.haggle = { trader: CONFIG.HAGGLE_WIN };
  expect(sellPrice(s, s.player, mags, IT.arming_sword)).toBe(12); // 10 × 1.2
  s.player.core.perks.push({ perkId: PK.haggler, source: 'level', gainedTurn: 0 });
  expect(sellPrice(s, s.player, mags, IT.arming_sword)).toBe(13); // 10 × 1.2 × 1.1, rounded down
});

it('143d a minted item is worth its base value × 2 × quality', () => {
  const s = shop();
  s.blueprints.push({ storyId: s.storyId, id: 'fine_dagger', kind: 'item', data: { id: 'fine_dagger', kind: 'weapon', name: 'fine dagger', look: 'a fine dagger', bulk: 1, value: 5, base: { itemId: IT.dagger, quality: 3, boosts: 'hitAdj' } } });
  expect(itemValue(s, 'fine_dagger')).toBe(itemValue(s, IT.dagger) * CONFIG.QUALITY_PRICE_FACTOR * 3);
});

it('143z selling counts the copper earned toward Peddler', () => {
  const s = shop();
  const r = sell(s, s.player, actorById(s, 'trader')!, SWORD, 1);
  expect(r.ok).toBe(true);
  expect(s.player.progression!.tally!.coin_earned).toBe(r.ok ? r.price : -1);
});
