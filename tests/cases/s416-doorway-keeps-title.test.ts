// 416 BG-1506: someone whose walk ended in the doorway between a room and a smaller one beside it was moved into the
// smaller room the next turn, without taking a step, and the turn check filed it (move_event). A point on a shared wall
// lies in both rooms, and the title of a point was the smallest room holding it, so re-titling everyone each turn
// (placeAll) moved them. A point on the edge between the title someone is in and another keeps the one they are in.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeAll } from '../../src/engine/position';
import { zoneAt } from '../../src/plan/where';
import { zoneById } from '../../src/engine/relations';

// the counter made a cramped room beside the common room, sharing its east wall, the doorway at (4, 0)
const village = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  zoneById(s, 'tav_counter')!.outline = [{ x: 4, y: -1.5 }, { x: 7, y: -1.5 }, { x: 7, y: 1.5 }, { x: 4, y: 1.5 }];
  return s;
};

it('someone in the doorway stays in the room they walked in from, turn after turn', () => {
  const s = village();
  const p = actor(s, 'patron_1');
  Object.assign(p, { zone: 'tav_common', placeId: 'tavern', pos: { x: 4, y: 0 } });
  placeAll(s);
  expect(p.zone).toBe('tav_common');
  expect(p.pos).toEqual({ x: 4, y: 0 });
  // the player, waiting in the doorway, is still in the common room after the turn, and no move went unseen
  Object.assign(s.player, { pos: { x: 4, y: 0 } });
  const ev = play(s, { intent: intent({ action: { type: 'wait' } }) });
  expect(s.player.zone).toBe('tav_common');
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'move')).toBe(false);
});

it('from the smaller room, the doorway is still the smaller room; a step inside either room is that room', () => {
  const s = village();
  expect(zoneAt(s, { x: 4, y: 0 }, 0, 'tav_counter')?.id).toBe('tav_counter');
  expect(zoneAt(s, { x: 4, y: 0 }, 0, 'tav_common')?.id).toBe('tav_common');
  expect(zoneAt(s, { x: 4.5, y: 0 }, 0, 'tav_common')?.id).toBe('tav_counter');
  expect(zoneAt(s, { x: 3.5, y: 0 }, 0, 'tav_counter')?.id).toBe('tav_common');
});
