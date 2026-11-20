// 41 Labels until names are known (BG-95): the opening uses the stranger label. A name said aloud is learned by whoever
// hears the words and sees whom it belongs to: the speaker's own, a bandmate's named in front of the listener, the
// player's own told to an NPC. A false name teaches nothing.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView } from '../../src/views';
import { learnNames } from '../../src/engine/effects';

const say = (s: GameState, id: string, actorId: string, text: string, more: Partial<GameEvent> = {}, earlier: GameEvent[] = []): GameEvent => {
  const e: GameEvent = { id, turn: 1, actorId, kind: 'speak', zone: 'tav_common', line: { text, volume: 'normal' }, effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...more };
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  learnNames(s, e, earlier); // as emit() does for every line
  return e;
};

it('41 Labels until names are known', () => {
  const s = makeVillage();
  const rng = createRng(1);
  const presence: GameEvent = { id: 'p1', turn: 0, actorId: 'patron_1', kind: 'presence', zone: 'tav_common', activity: 'drink', effects: [], noise: 'quiet', visibility: 'normal', perception: {} };
  presence.perception = computePerception(presence, s, rng);
  const opening = buildNarrationView(s, [presence], null);
  expect(opening.events[0].actor).toBe('a tavern patron');
  expect(opening.actors).toContainEqual(expect.objectContaining({ label: 'a tavern patron', zone: 'common room', activityLook: 'nursing a drink' }));
  expect(JSON.stringify(opening)).not.toContain('Old Wim');

  const line = say(s, 'v1', 'patron_1', "Name's Wim. Just Wim.");
  const next = buildNarrationView(s, [line], null);
  expect(next.events[0].actor).toBe('Old Wim');
  expect(next.heard).toEqual([{ speaker: 'Old Wim', text: "Name's Wim. Just Wim.", volume: 'normal' }]);
  expect(next.actors.find((a) => a.label === 'a tavern patron')).toMatchObject({ label: 'a tavern patron', name: 'Old Wim' });
});

