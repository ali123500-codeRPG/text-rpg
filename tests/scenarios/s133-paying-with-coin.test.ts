// 133 Paying with coin (D-93, PY1–PY10): a Trader's wares show at the player's prices; buy swaps coin for goods or a
// service with no roll; haggling and Hard Bargain change the price; clinic care is bought, then used by resting.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { applyHaggle, buy, coinWords, coins, warePrice } from '../../src/engine/trade';
import { SV } from '../../src/library/serviceIds';
import type { ContestResult, GameState } from '../../src/types';

function shop(): GameState {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const mags = actorById(s, 'trader')!;
  mags.wares = { items: ['healing_draught'], services: [SV.drink, SV.clinic] };
  mags.core.inventory.push({ id: 'stock', itemId: 'healing_draught', qty: 3 });
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== 'coin');
  s.player.core.inventory.push({ id: 'purse', itemId: 'coin', qty: 20 });
  return s;
}
const gap = (g: number) => ({ gap: g }) as ContestResult;

it('133a coin words', () => {
  expect(coinWords(125)).toBe('1 gold, 2 silver and 5 copper');
  expect(coinWords(20)).toBe('2 silver');
  expect(coinWords(0)).toBe('0 copper');
});

it('133b wares, buying a service, and a refused sale', () => {
  const s = shop();
  const mags = buildPlayerView(s).actors.find((a) => a.id === 'trader')!;
  expect(mags.wares).toEqual([
    { id: 'goods:healing_draught', name: 'healing draught', price: '2 silver', stock: 3 }, // value 10 × markup 2
    { id: `service:${SV.drink}`, name: 'drink', price: '2 copper' },
    { id: `service:${SV.clinic}`, name: 'clinic care', price: '4 silver' },
  ]);
  const ev = play(s, { intent: intent({ action: { type: 'buy', target: 'trader', item: `service:${SV.drink}`, qty: 2 } }) });
  expect(coins(s.player)).toBe(16);
  const b = ev.find((e) => e.kind === 'buy')!;
  const nv = buildNarrationView(s, [b]).events[0];
  expect([nv.item, nv.price]).toEqual(['2 drink', '4 copper']);
  // a draught costs 20; 16 is not enough, and nothing changes
  const ev2 = play(s, { intent: intent({ action: { type: 'buy', target: 'trader', item: 'goods:healing_draught' } }) });
  expect(ev2.find((e) => e.kind === 'buy_refused')!.reason).toBe('not_enough_coin');
  expect(coins(s.player)).toBe(16);
});

it('133c goods move, buying for someone, an opposed seller refuses', () => {
  const s = shop();
  const mags = actorById(s, 'trader')!;
  const wim = actorById(s, 'patron_1')!;
  wim.zone = s.player.zone;
  const r = buy(s, s.player, mags, 'goods:healing_draught', 1, wim);
  expect(r.ok).toBe(true);
  expect(coins(s.player)).toBe(0);
  expect(wim.core.inventory.find((i) => i.itemId === 'healing_draught')?.qty).toBe(1);
  expect(mags.core.inventory.find((i) => i.id === 'stock')?.qty).toBe(2);
  mags.mind!.overrides = { player: 'opposed' };
  expect(buy(s, s.player, mags, `service:${SV.drink}`, 1)).toEqual({ ok: false, reason: 'refuses' });
});

it('133d haggling and Hard Bargain', () => {
  const s = shop();
  const mags = actorById(s, 'trader')!;
  const p = s.player;
  applyHaggle(p, mags, gap(-1)); // won
  expect(warePrice(s, p, mags, 'goods:healing_draught')).toBe(16);
  applyHaggle(p, mags, gap(1)); // lost by one: no change
  expect(warePrice(s, p, mags, 'goods:healing_draught')).toBe(16);
  applyHaggle(p, mags, gap(2)); // lost by two
  expect(warePrice(s, p, mags, 'goods:healing_draught')).toBe(24);
  delete p.haggle;
  p.core.perks.push({ perkId: 'haggler', source: 'level', turn: 0 } as never);
  expect(warePrice(s, p, mags, 'goods:healing_draught')).toBe(18); // 20 × 0.9
});

it('133e clinic care is bought, then used by resting in the clinic', () => {
  const s = shop();
  s.places.find((x) => x.id === s.player.placeId)!.kind = 'clinic';
  s.player.core.inventory.find((i) => i.id === 'purse')!.qty = 40;
  const c = s.player.core.condition;
  c.hpLostPct = 60;
  play(s, { intent: intent({ action: { type: 'rest' } }) });
  expect(c.hpLostPct).toBeGreaterThan(0); // unpaid: the plain rest row
  s.clocks = {};
  play(s, { intent: intent({ action: { type: 'buy', target: 'trader', item: `service:${SV.clinic}` } }) });
  expect(s.player.paid).toEqual(['clinic']);
  play(s, { intent: intent({ action: { type: 'rest' } }) });
  expect(c.hpLostPct).toBe(0);
  expect(s.player.paid).toEqual([]);
});
