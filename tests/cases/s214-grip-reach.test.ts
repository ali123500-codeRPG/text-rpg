// 214 FR2–FR4 (Bug Fix Review): reach is grip reach in real metres, from the body's grip parts, never "the same zone".
// Handing over needs both grip reaches (BG-85), a pick-up is within reach of where the item lies (BG-85), a door is worked
// from within reach of its doorway (BG-86), a hold stands while the held one is within the holder's grip (BG-104). Grip and
// weapon needs close in on the move slot when the action comes (one approach table, NEEDS).
import { expect, it } from 'vitest';
import type { Barrier, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scenario/geometry';
import { distM, placeAll, wayPoint } from '../../src/engine/position';
import { gripReachM, withinGrip } from '../../src/engine/gear';
import { heldBy, zoneById } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { BK } from '../../src/library/tableIds';
import { BT } from '../../src/library/raceIds';
import { IT } from '../../src/library/itemIds';

/** the village laid out in metres, the player in the common room */
function laidOut(): GameState {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
  const zs = s.places.flatMap((p) => p.zones);
  for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, zs);
  placeAll(s);
  return s;
}
const door = (s: GameState): Barrier => {
  const b: Barrier = { id: 'front_door', kind: BK.door, grade: 'minor' };
  (s.barriers ??= {})[b.id] = b;
  zoneById(s, 'tav_common')!.links.find((l) => l.to === 'street_door')!.barrier = b.id;
  zoneById(s, 'street_door')!.links.find((l) => l.to === 'tav_common')!.barrier = b.id;
  return b;
};

it('FR2: grip reach comes from the body: an arm 0.7 m; a dragon takes things in its jaws (1.5 m); a slime has no grip', () => {
  const s = laidOut();
  expect(gripReachM(s, s.player)).toBe(0.7);
  s.player.core.bodyTypeId = BT.winged_quadruped;
  expect(gripReachM(s, s.player)).toBe(1.5);
  s.player.core.bodyTypeId = BT.amorphous;
  expect(gripReachM(s, s.player)).toBe(0);
});

it('BG-86: a door out of reach is walked to on the move slot and opened with the main action when it is free', () => {
  const s = laidOut();
  const b = door(s);
  const dp = { zone: 'tav_common', pos: wayPoint(s, 'tav_common', 'street_door', s.player)! };
  s.player.pos = { x: dp.pos.x + (zoneById(s, 'tav_common')!.rect!.x - dp.pos.x) * 0.8, y: dp.pos.y + (zoneById(s, 'tav_common')!.rect!.y - dp.pos.y) * 0.8 };
  expect(withinGrip(s, s.player, dp)).toBe(false);
  // busy with something else: the walk to the door takes the move, the door waits for the next turn
  play(s, { intent: intent({ way: { toZone: 'street_door', op: 'open' }, action: { type: 'observe', target: null } }) });
  expect(b.open).toBeUndefined();
  expect(s.log.some((l) => l.code === 'way_op_dropped')).toBe(true); // at the door now, with no slot left for it
  expect(withinGrip(s, s.player, dp)).toBe(true);
  play(s, { intent: intent({ way: { toZone: 'street_door', op: 'open' } }) });
  expect(b.open).toBe(true);
  // from across the room with nothing else to do: walk over, then open it on the main action, in one turn
  const t = laidOut();
  const tb = door(t);
  t.player.pos = { x: dp.pos.x + (zoneById(t, 'tav_common')!.rect!.x - dp.pos.x) * 0.8, y: dp.pos.y + (zoneById(t, 'tav_common')!.rect!.y - dp.pos.y) * 0.8 };
  const ev = play(t, { intent: intent({ way: { toZone: 'street_door', op: 'open' } }) });
  expect(tb.open).toBe(true);
  expect(ev.some((e) => e.kind === 'hold' && e.actorId === t.player.id)).toBe(false);
});

it('BG-85: a pick-up is within grip reach of where the item lies: a few steps away it is walked to first; across a street it is not reached', () => {
  const s = laidOut();
  const room = zoneById(s, 'tav_common')!;
  s.player.pos = { x: room.rect!.x - 2, y: room.rect!.y };
  room.groundItems.push({ id: 'cup', itemId: IT.curio, at: { x: room.rect!.x + 2, y: room.rect!.y } });
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'cup' }] }) });
  expect(s.player.core.inventory.some((i) => i.id === 'cup')).toBe(true);
  expect(s.player.core.inventory.find((i) => i.id === 'cup')!.at).toBeUndefined();
  const street = zoneById(s, 'field_n') ?? zoneById(s, 'street_square')!;
  street.groundItems.push({ id: 'far', itemId: IT.curio, at: { x: street.rect!.x, y: street.rect!.y } });
  expect(distM(s, s.player, { zone: street.id, pos: street.groundItems.at(-1)!.at })).toBeGreaterThan(CONFIG.ZONE_SIZE_M2.room ** 0.5);
  play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'far' }] }) });
  expect(s.player.core.inventory.some((i) => i.id === 'far')).toBe(false);
});

it('BG-85: something dropped lies where its owner stood', async () => {
  const { dropToGround } = await import('../../src/engine/gear');
  const s = laidOut();
  s.player.core.inventory.push({ id: 'cup', itemId: IT.curio });
  dropToGround(s, s.player, 'cup', s.player.zone);
  expect(zoneById(s, s.player.zone)!.groundItems.find((i) => i.id === 'cup')!.at).toEqual(s.player.pos);
});

it('BG-104: a hold stands while the held one is within the holder\'s grip reach, not merely in the same zone', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const room = zoneById(s, 'tav_common')!;
  room.rect = { x: 0, y: 0, w: 10, d: 10 };
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = 'tav_common'; s.player.zone = 'tav_common';
  s.player.pos = { x: 0, y: 0 }; p.pos = { x: 0.5, y: 0 };
  s.player.heldBy = p.id;
  expect(heldBy(s, s.player)).toBe(p);
  p.pos = { x: 3, y: 0 };
  expect(heldBy(s, s.player)).toBeUndefined();
});

it('FR4: a give from across the room closes in on the move slot to the player\'s side of the counter, then hands it over the counter', async () => {
  const { EK } = await import('../../src/library/tableIds');
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  const z = (id: string) => zoneById(s, id)!;
  z('tav_common').rect = { x: 0, y: 0, w: 8, d: 8 }; z('tav_common').edges = { n: EK.low, e: EK.wall, s: EK.wall, w: EK.wall };
  z('tav_counter').rect = { x: 0, y: 5.5, w: 3, d: 3 }; z('tav_counter').edges = { n: EK.wall, e: EK.wall, s: EK.low, w: EK.wall };
  const trader = s.actors.find((a) => a.id === 'trader')!;
  trader.pos = { x: 0, y: 4.6 };
  s.player.zone = 'tav_common'; s.player.pos = { x: 0, y: -3 };
  s.player.core.inventory.push({ id: 'cup', itemId: IT.curio });
  const ev = play(s, { intent: intent({ action: { type: 'give', target: 'trader', item: 'cup' } }) });
  expect(s.player.zone).toBe('tav_common'); // never behind the counter
  expect(ev.some((e) => e.kind === 'give' && e.actorId === s.player.id)).toBe(true);
  expect(trader.core.inventory.some((i) => i.id === 'cup')).toBe(true);
});
