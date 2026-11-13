// BG-210: a Trader the Weaver brings back keeps what it has: the purse comes once, listed goods top up to the listed count.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
const count = (a: Actor, item: string) => a.core.inventory.filter((i) => i.itemId === item).reduce((n, i) => n + (i.qty ?? 1), 0);
/** a later plan that only brings back `a` with the barkeep's wares */
function bringBack(st: GameState, a: Actor, seed: number) {
  const first = villageStagePlan('success');
  const c = first.cast.find((x) => x.key === 'barkeep')!;
  const p = { ...first, places: [], zones: [], bands: [], frontiers: [], rewards: [], containers: [], spars: [], seeds: { plans: [], triggers: [], secrets: [] },
    cast: [{ ...c, template: undefined, actor: a.id, band: a.bandId!, slots: { ...(a.mind!.slots ?? {}) } }] };
  st.turn += 5;
  applyStagePlan(st, p as never, ctx, { entry: 'open' }, createRng(seed));
}

it('BG-210: a returning Trader gets no second purse and no stock on top; sold goods are topped up', () => {
  const st = toStoryStart(makeVillage());
  applyStagePlan(st, villageStagePlan('success'), ctx, { entry: 'open' }, createRng(1));
  const mags = st.actors.find((a) => a.names?.current === 'Mags')!;
  const coin = count(mags, IT.coin);
  expect(count(mags, IT.bandage)).toBe(4);
  bringBack(st, mags, 2);
  expect([count(mags, IT.coin), count(mags, IT.bandage)]).toEqual([coin, 4]);
  // she sells one bandage: the next scenario tops her back up to the listed 4
  const b = mags.core.inventory.find((i) => i.itemId === IT.bandage)!;
  if ((b.qty ?? 1) > 1) b.qty = b.qty! - 1; else mags.core.inventory = mags.core.inventory.filter((i) => i !== b);
  expect(count(mags, IT.bandage)).toBe(3);
  bringBack(st, mags, 3);
  expect([count(mags, IT.coin), count(mags, IT.bandage)]).toEqual([coin, 4]);
  expect(mags.wares?.items).toEqual([IT.bandage]);
});

it('BG-210: a new Trader still gets the purse', () => {
  const st = toStoryStart(makeVillage());
  applyStagePlan(st, villageStagePlan('success'), ctx, { entry: 'open' }, createRng(1));
  const mags = st.actors.find((a) => a.names?.current === 'Mags')!;
  expect(mags.core.inventory.some((i) => i.itemId === IT.coin && i.qty === CONFIG.TRADER_PURSE)).toBe(true);
});
