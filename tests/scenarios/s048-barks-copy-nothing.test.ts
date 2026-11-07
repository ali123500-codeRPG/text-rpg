// 48 Barks copy nothing: an NPC shouts a warning while attacking; listeners' beliefs are unchanged.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';

const run = (s: GameState, e: GameEvent) => {
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  return e;
};

it('48 Barks copy nothing', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  place(s, 'slime_1', 'gate_inner');
  actor(s, 'guard_1').mind!.knowledge.slime_1 = { status: 'tracking', lastKnownZone: 'gate_inner', lastSeenTurn: 1, source: 'seen', revealed: [] };
  run(s, { id: 'e1', turn: 1, actorId: 'guard_1', kind: 'attack', zone: 'gate_inner', target: 'slime_1', effects: [], noise: 2, visibility: 2, perception: {} });
  const before = structuredClone(s.actors.map((a) => [a.id, a.mind?.knowledge]));
  const bark = run(s, { id: 'e2', turn: 1, actorId: 'guard_1', kind: 'speak', zone: 'gate_inner', bark: true, line: { text: 'Slime at the gate!', volume: 'shout' }, effects: [], noise: 3, visibility: 2, perception: {} });
  expect(Object.keys(bark.perception).length).toBeGreaterThan(1); // it was heard (and is narrated)
  expect(s.actors.map((a) => [a.id, a.mind?.knowledge])).toEqual(before);
  expect(actor(s, 'trader').mind!.knowledge.slime_1).toBeUndefined();
});
