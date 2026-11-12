// 41 Labels until names are known (BG-95): the opening uses the stranger label. A name said aloud is learned by whoever
// hears the words and sees whom it belongs to: the speaker's own, a bandmate's named in front of the listener, the
// player's own told to an NPC. A false name teaches nothing.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, createRng, place } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView, buildOppositionView } from '../../src/views';
import { learnNames } from '../../src/engine/effects';

const say = (s: GameState, id: string, actorId: string, text: string): GameEvent => {
  const e: GameEvent = { id, turn: 1, actorId, kind: 'speak', zone: 'tav_common', line: { text, volume: 'normal' }, effects: [], noise: 'normal', visibility: 'normal', perception: {} };
  e.perception = computePerception(e, s, createRng(1));
  updateBeliefs(s, { kind: 'event', event: e });
  learnNames(s, e); // as emit() does for every line
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

it('BG-95: a bandmate named in front of the player is learned; a false name or a lowercase word is not', () => {
  const s = makeVillage();
  s.actors.find((a) => a.id === 'trader')!.knownOnSight = undefined;
  place(s, 'trader', 'tav_common');
  say(s, 'v1', 'patron_1', "Call me Tam. Mags will pour you one if you ask.");
  expect(s.player.journal!.namesKnown).toEqual(['trader']); // Wim knows his bandmate Mags; "Tam" is no one's name
  say(s, 'v2', 'trader', 'I will, love. Bertram at the gate owes me two.');
  expect(s.player.journal!.namesKnown).toEqual(['trader']); // Bertram is not in sight, and Mags does not know him by name
});

it('BG-95: an NPC who hears the player give their name keeps it, in its view of the player', () => {
  const s = makeVillage();
  s.actors.find((a) => a.id === 'patron_1')!.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] }; // he has seen the player come in
  expect(buildOppositionView(s, 'patron_1').beliefs.find((b) => b.about === 'player')?.name).toBeUndefined();
  say(s, 'v1', 'player', "I'm Aldric, from up the valley.");
  expect(s.actors.find((a) => a.id === 'patron_1')!.mind!.namesKnown).toEqual(['player']);
  expect(buildOppositionView(s, 'patron_1').beliefs.find((b) => b.about === 'player')).toMatchObject({ about: 'player', name: 'Aldric' });
});
