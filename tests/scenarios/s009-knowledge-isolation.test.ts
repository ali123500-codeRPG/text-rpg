// 9 Knowledge isolation: guard 1 sees the player; guard 2, out of earshot, has no belief until it perceives guard 1's shout,
// then holds suspicious with source 'told'.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { computePerception, updateBeliefs } from '../../src/perception';

const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  return e;
};

it('9 Knowledge isolation', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  s.actors.push(spawnNpc(s, 'guard', { id: 'guard_2', zone: 'field_far', placeId: 'field', bandId: 'village_watch', name: 'Hal' }));
  const move: GameEvent = { id: 'e1', turn: 1, actorId: 'player', kind: 'move', zone: 'street_square', effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  run(s, move);
  // open player, major action: guard 1's detection test reads its perception level (full) -> aware
  updateBeliefs(s, { kind: 'detection', observerId: 'guard_1', aboutId: 'player', status: 'aware', event: move });
  expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
  expect(actor(s, 'guard_2').mind!.knowledge.player).toBeUndefined();
  // a normal-volume line does not carry to guard 2 (three links away)
  run(s, { id: 'e2', turn: 1, actorId: 'guard_1', kind: 'speak', zone: 'gate_inner', line: { text: 'Who goes there?', volume: 'normal' }, effects: [], noise: 'quiet', visibility: 'normal', perception: {} });
  expect(actor(s, 'guard_2').mind!.knowledge.player).toBeUndefined();
  run(s, { id: 'e3', turn: 1, actorId: 'guard_1', kind: 'call_help', zone: 'gate_inner', line: { text: 'To me! Intruder!', volume: 'shout' }, effects: [], noise: 'loud', visibility: 'normal', perception: {} });
  expect(actor(s, 'guard_2').mind!.knowledge.player).toEqual({ status: 'suspicious', source: 'told', lastKnownZone: 'street_square', lastSeenTurn: 1, revealed: [] });
});
