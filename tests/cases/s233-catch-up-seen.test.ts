// BF2a-d (BG-119, runs 75f, 79, 81, 82b, 85b): the end-of-turn catch-up moved people on in one silent jump, so someone in
// plain view simply vanished. On an action's turn each catch-up leg is now a move event like any walk, perceived by the
// normal rules: the player sees them get up and go, and where to while in sight; legs nobody perceives stay silent.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { play } from './w4-kit';
import { headTo } from '../../src/minds';

it('BF2: a catch-up walk in sight is seen', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = s.actors.find((a) => a.id === 'patron_1')!;
  expect(m.zone).toBe('tav_common');
  headTo(s, m, 'street_square', 'weaver');
  const ev = play(s);
  const caught = s.log.find((l) => l.code === 'caught_up' && l.detail?.actorId === m.id);
  expect(caught).toBeTruthy();
  const moves = ev.filter((e) => e.actorId === m.id && e.kind === 'move');
  expect(moves.at(-1)!.zone).toBe(m.zone); // every leg is an event, ending where they are
  const out = moves.find((e) => e.fromZone === 'tav_common')!;
  expect(out.perception[s.player.id]?.level).toBe('full'); // seen leaving the room
});
