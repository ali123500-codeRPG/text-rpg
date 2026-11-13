// BG-170 (run 97d t28): on the edge the back lane shares with Mill Lane, "walk out into Mill Lane and grab Wen's arm":
// the doorway crossing was 0 m, and a walk leg of 0 m ended the walk, so the closing in stopped 0.3 m short of Wen and the
// grab was wasted. One rule: a 0 m crossing walks nothing, and the walk goes on with the metres it has left.
import { expect, it } from 'vitest';
import { byDoor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';

it('crossing a doorway underfoot, the walk still closes in and the grab lands', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'guard_1'] });
  byDoor(s, 'player', 'street_door', 'tav_common', 0);
  byDoor(s, 'patron_1', 'tav_common', 'street_door', 1);
  const ev = play(s, { intent: intent({ move: { toZone: 'tav_common' }, action: { type: 'restrain', target: 'patron_1' } }) });
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'wasted')).toBe(false);
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'restrain')).toBe(true);
});
