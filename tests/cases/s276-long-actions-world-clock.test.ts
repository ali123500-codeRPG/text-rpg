// 276 Action time stage 3d-2 (AT42, AT45, AT46, AT65): outside a fight a turn lasts as long as the player's order, at most
// EXPLORE_TURN_S; an action longer than that (a trade, heavy armour) runs on the world clock and takes effect when its time
// is done. Stopped on the way, it waits (busy) for the same order again, unless its focus is deep; one that would be
// refused is refused at once. A night runs on as one stretch: a foe after the sleeper that reaches them stops it.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { now, startClock } from '../../src/time';
import { CONFIG } from '../../src/config';
import { mechanicsLines } from '../../src/agents/game';
import { IT } from '../../src/library/itemIds';
import { SV } from '../../src/library/serviceIds';
import { DU } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import type { GameState } from '../../src/types';

const shop = () => {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.actors.find((a) => a.id === 'trader')!.wares = { items: [], services: [SV.drink] };
  s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== IT.coin);
  return s;
};
const buyDrink = intent({ action: { type: 'buy', target: 'trader', item: `service:${SV.drink}` } });
const tradeMin = () => getLibrary().durations![DU.trade].seconds / 60;
const armour = (s: GameState) => { s.player.core.inventory.push({ id: 'coat', itemId: IT.lamellar_coat, qty: 1 }); return intent({ action: { type: 'equip', item: 'coat' } }); };
const worn = (s: GameState) => !!s.player.core.inventory.find((i) => i.id === 'coat')?.equippedIn?.includes('armor');

describe('276 long actions on the world clock', () => {
  it('AT45: a trade nobody disturbs runs its time on the world clock and goes through at its end', () => {
    const s = shop();
    s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 20 });
    const t0 = now(s);
    const ev = play(s, { intent: buyDrink });
    expect(now(s) - t0).toBeCloseTo(tradeMin(), 1);
    expect(ev.some((e) => e.kind === 'buy' && e.actorId === 'player')).toBe(true);
    expect(s.player.busy).toBeUndefined();
  });
  it('AT45: a trade that would be refused is refused at once, its time not spent', () => {
    const s = shop();
    const t0 = now(s);
    const ev = play(s, { intent: buyDrink });
    expect(ev.find((e) => e.kind === 'buy_refused')?.reason).toBe('not_enough_coin');
    expect(now(s) - t0).toBeLessThanOrEqual(CONFIG.EXPLORE_TURN_S / 60);
    expect(s.player.busy).toBeUndefined();
  });
  it('AT45/AT65: stopped on the way, heavy armour waits half on; the same order again finishes it in the time left', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    place(s, 'guard_1', 'street_square');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'hunting', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const order = armour(s);
    const ev = play(s, { intent: order });
    const b = s.player.busy!;
    expect(b).toMatchObject({ row: DU.armor_heavy_on });
    expect(b.done).toBeGreaterThan(0);
    expect(b.done).toBeLessThan(b.need);
    expect(worn(s)).toBe(false);
    expect(mechanicsLines(s, ev).some((l) => /^Put on heavy armour stopped (at once|after .+): someone/.test(l))).toBe(true);
    // the guard goes off to the far field and forgets the player; the player keeps at it
    place(s, 'guard_1', 'field_far');
    g.mind!.overrides = {};
    g.mind!.knowledge = {};
    s.mode = 'explore'; // no fight any more
    s.pending.mode = 'explore';
    const left = (b.need - b.done) / 60, t1 = now(s);
    play(s, { intent: order });
    expect(worn(s)).toBe(true);
    expect(s.player.busy).toBeUndefined();
    expect(now(s) - t1).toBeCloseTo(Math.max(left, 0), 0);
  });
  it('AT46: a short order outside a fight is a short turn (a look around), an order with no time of its own the action row', () => {
    const s = shop();
    const t0 = now(s);
    play(s, { intent: intent({ action: { type: 'observe' } }) });
    expect(now(s) - t0).toBeCloseTo(getLibrary().durations![DU.look].seconds / 60, 6);
  });
});

describe('276 the night as one stretch (AT42)', () => {
  it('a foe after the sleeper who is there already and reaches them stops the night: its blow comes next turn', () => {
    const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2', 'patron_1'] });
    startClock(s, 'evening');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    place(s, 'guard_1', 'tav_cellar');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'hunting', lastKnownZone: 'tav_cellar', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const t0 = now(s);
    play(s, { intent: intent({ action: { type: 'sleep' } }) });
    expect(s.log.find((l) => l.code === 'sleep_stopped')?.detail).toMatchObject({ by: ['guard_1'] });
    expect(now(s) - t0).toBeLessThan(60);
  });
});
