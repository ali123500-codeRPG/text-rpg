// BG-124: "Yes, I'll walk out with you; let's go out the front together" lost the player's move. The common room's
// counter side (a low edge) faced the street too, so the door to the street counted as "reached across" and the move
// became a step up to the listener. Only a way seen through (a counter, a rail) is reached across, never a door.
// BG-125: "I'm going to check your pockets" at someone the player could not make out: the action's target dropped
// out of the Narrator's view, which then wrote the player searching their own pockets.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, place } from '../harness';
import { approachMove } from '../../src/engine/merge';
import { buildNarrationView } from '../../src/views';
import { EK } from '../../src/library/tableIds';

it('BG-124: talking to someone while walking out a door beside a counter side keeps the walk', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  s.zones.find((z) => z.id === 'tav_common')!.edges = { n: EK.low, e: EK.low, s: EK.low, w: EK.low };
  const talk = { type: 'talk', target: 'patron_1' };
  expect(approachMove(s, s.player, talk, { toZone: 'street_door' })?.toZone).toBe('street_door');
  expect(approachMove(s, s.player, talk, { toZone: 'tav_counter' })).toMatchObject({ toZone: 'tav_common', spot: { near: 'patron_1' } });
});

it('BG-125: the player acting at someone they cannot see still acts at someone', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  place(s, 'patron_1', 'tav_cellar');
  s.player.zone = 'tav_common';
  const e = { id: 't1.1', turn: s.turn, actorId: s.player.id, kind: 'interact', zone: 'tav_common', target: 'patron_1', effects: [], noise: 'quiet', visibility: 'normal',
    perception: { [s.player.id]: { level: 'full', cue: 'sight' } } } as unknown as GameEvent;
  expect(buildNarrationView(s, [e], null).events[0].target).toBe('someone');
});
