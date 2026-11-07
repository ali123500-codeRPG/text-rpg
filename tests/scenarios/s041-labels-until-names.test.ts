// 41 Labels until names are known: the opening uses the stranger label; after a Voice line with introduces = [speaker],
// the next NarrationView uses the name.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView } from '../../src/views';

it('41 Labels until names are known', () => {
  const s = makeVillage();
  const rng = createRng(1);
  const presence: GameEvent = { id: 'p1', turn: 0, actorId: 'patron_1', kind: 'presence', zone: 'tav_common', activity: 'drink', effects: [], noise: 1, visibility: 2, perception: {} };
  presence.perception = computePerception(presence, s, rng);
  const opening = buildNarrationView(s, [presence], null);
  expect(opening.events[0].actor).toBe('a tavern patron');
  expect(opening.actors).toContainEqual({ label: 'a tavern patron', zone: 'common room', activityLook: 'nursing a drink' });
  expect(JSON.stringify(opening)).not.toContain('Old Wim');

  const line: GameEvent = { id: 'v1', turn: 1, actorId: 'patron_1', kind: 'speak', zone: 'tav_common', line: { text: "Name's Wim. Old Wim.", volume: 'normal', introduces: ['patron_1'] }, effects: [], noise: 1, visibility: 2, perception: {} };
  line.perception = computePerception(line, s, rng);
  updateBeliefs(s, { kind: 'event', event: line });
  const next = buildNarrationView(s, [line], null);
  expect(next.events[0].actor).toBe('Old Wim');
  expect(next.heard).toEqual([{ speaker: 'Old Wim', text: "Name's Wim. Old Wim.", volume: 'normal' }]);
  expect(next.actors.find((a) => a.label === 'a tavern patron')).toMatchObject({ label: 'a tavern patron', name: 'Old Wim' });
});
