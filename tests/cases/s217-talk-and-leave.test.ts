// BG-124: "Yes, I'll walk out with you; let's go out the front together" lost the player's move. The common room's
// counter side (a low edge) faced the street too, so the door to the street counted as "reached across" and the move
// became a step up to the listener. Only a way seen through (a counter, a rail) is reached across, never a door.
// BG-125: "I'm going to check your pockets" at someone the player could not make out: the action's target dropped
// out of the Narrator's view, which then wrote the player searching their own pockets.
import { expect, it } from 'vitest';
import { COUNTER_SHAPE, makeVillage, place } from '../harness';
import { approachMove } from '../../src/engine/merge';

it('BG-124: talking to someone while walking out a door beside a counter side keeps the walk', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'], shape: COUNTER_SHAPE }); // the counter on one side, the front door on another
  place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  const talk = { type: 'talk', target: 'patron_1' };
  expect(approachMove(s, s.player, talk, { toZone: 'street_door' })?.toZone).toBe('street_door');
  expect(approachMove(s, s.player, talk, { toZone: 'tav_counter' })).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

