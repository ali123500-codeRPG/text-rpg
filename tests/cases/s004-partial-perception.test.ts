// 4 Partial perception: an enemy moves out of sight noisily; the Narrator gets the sound only, with no name.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, place, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView } from '../../src/views';

it('4 Partial perception', () => {
  const s = makeVillage({ playerZone: 'street_door' });
  place(s, 'slime_1', 'tav_common');
  const e: GameEvent = { id: 'e1', turn: 1, actorId: 'slime_1', kind: 'move', zone: 'tav_counter', fromZone: 'tav_common', effects: [], noise: 'loud', visibility: 'normal', perception: {} }; // BG-57: 16 m and a shut door away
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  const v = buildNarrationView(s, [e], null);
  expect(v.events).toEqual([{ id: 'e1', kind: 'move', level: 'partial', cue: 'sound', where: 'inside the tavern' }]);
  const text = JSON.stringify(v);
  for (const w of ['slime_1', 'a slime', '"slime"', 'tav_counter', 'behind the bar']) expect(text).not.toContain(w);
});
