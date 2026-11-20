// 276 Action time stage 3d-2 (AT42, AT45, AT46, AT65): outside a fight a turn lasts as long as the player's order, at most
// EXPLORE_TURN_S; an action longer than that (a trade) runs on the world clock and takes effect when its time
// is done. Stopped on the way, it waits (busy) for the same order again, unless its focus is deep; one that would be
// refused is refused at once. A night runs on as one stretch: a foe after the sleeper that reaches them stops it.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { wallsAround, holeSpot } from '../../src/plan/holes';
import { waysOut } from '../../src/plan/where';
import { zoneById } from '../../src/engine/relations';
import { breakJob, jobShare, secondsLeft, type BreakJob } from '../../src/engine/breakThrough';
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
// breaking through the brick wall to the bar: a slow action whose work stays on the wall when it is broken off
const breakWall = (s: GameState) => {
  const w = wallsAround(s, zoneById(s, 'tav_common')!).find((x) => x.behind?.id === 'tav_counter')!.wall;
  const z = zoneById(s, 'tav_common')!, at = holeSpot(s, w, s.player.pos ?? { x: 0, y: 0 })!;
  const c = z.outline.reduce((p, q) => ({ x: p.x + q.x / z.outline.length, y: p.y + q.y / z.outline.length }), { x: 0, y: 0 });
  const dx = c.x - at.x, dy = c.y - at.y, len = Math.hypot(dx, dy);
  s.player.pos = { x: at.x + dx / len * 0.5, y: at.y + dy / len * 0.5 }; // half a metre in from the wall
  return intent({ action: { type: 'break', target: 'tav_counter' } });
};
const broken = (s: GameState) => waysOut(s, 'tav_common').some((l) => l.to === 'tav_counter' && !!l.opening.wall);
const job = (s: GameState) => breakJob(s, s.player, 'tav_counter') as BreakJob;

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
  it('AT45/AT65: stopped on the way, a slow action keeps its work; the same order again finishes it in the time left', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    place(s, 'guard_1', 'street_square');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'hunting', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const order = breakWall(s);
    const ev = play(s, { intent: order });
    expect(ev.some((e) => e.actorId === 'player' && e.kind === 'busy')).toBe(true);
    // its work is kept on the wall (BW13 a): part done, not through
    expect(jobShare(job(s))).toBeGreaterThan(0);
    expect(jobShare(job(s))).toBeLessThan(1);
    // the hunting guard stops it: seen closing in, or first heard as a foe (which comes first hangs on the zones' sizes)
    expect(mechanicsLines(s, ev).some((l) => /^Break through a wall or barrier stopped (at once|after .+): (someone|a fight)/.test(l))).toBe(true);
    // the guard goes off to the far field and forgets the player; the player keeps at it
    place(s, 'guard_1', 'field_far');
    g.mind!.overrides = {};
    g.mind!.knowledge = {};
    s.mode = 'explore'; // no fight any more
    s.pending.mode = 'explore';
    const left = secondsLeft(s, s.player, job(s)) / 60, t1 = now(s);
    const ev2 = play(s, { intent: order });
    expect(ev2.find((e) => e.actorId === 'player' && e.kind === 'break_through')?.breakThrough).toMatchObject({ share: 1, state: 'destroyed' });
    expect(broken(s)).toBe(true); // through: a way to the bar
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
