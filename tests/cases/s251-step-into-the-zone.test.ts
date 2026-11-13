// BG-166 (run 97c t26-27): standing on the edge the back lane shares with Mill Lane, 1 m from Wen across it, "step out into
// Mill Lane" was already "beside him", so no step was taken and the player stayed in the lane while the story put them in
// Mill Lane. One rule: a move to a spot in another zone always goes into that zone.
import { expect, it } from 'vitest';
import { byDoor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';

it('a move beside someone in the next zone, already within a step of them, still steps into that zone', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'guard_1'] });
  byDoor(s, 'player', 'street_door', 'tav_common', 0.01);
  byDoor(s, 'patron_1', 'tav_common', 'street_door', 0.5);
  play(s, { intent: intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1' } } }) });
  expect(s.player.zone).toBe('tav_common');
});
