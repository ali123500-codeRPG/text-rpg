// 41 Labels until names are known (BG-95): the opening uses the stranger label. A name said aloud is learned by whoever
// hears the words and sees whom it belongs to: the speaker's own, a bandmate's named in front of the listener, the
// player's own told to an NPC. A false name teaches nothing.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, createRng, place } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView, buildPlayerView } from '../../src/views';
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

it('NM2: a name said of someone out of sight is heard of, and attaches when they answer to it', () => {
  const s = makeVillage();
  s.actors.find((a) => a.id === 'trader')!.knownOnSight = undefined;
  place(s, 'trader', 'tav_cellar');
  say(s, 'v1', 'patron_1', 'Mags keeps the cellar key, ask her.');
  expect(s.player.journal!.namesKnown).toEqual([]);
  expect(s.player.journal!.heardOf).toEqual(['trader']);
  expect(buildPlayerView(s).heardOf).toEqual(['Mags']);
  place(s, 'trader', 'tav_common');
  const call = say(s, 'p1', 'player', 'Mags, about the cellar key.', { speech: { skill: 'x', addressees: ['trader'] } });
  say(s, 'v2', 'trader', 'What about it, love?', {}, [call]);
  expect(s.player.journal!.namesKnown).toEqual(['trader']);
  expect(s.player.journal!.heardOf).toEqual([]);
});

it('NM3/NM6: a believed false name is what the listener calls them; a caught one is not; a remark still teaches', () => {
  const s = makeVillage();
  say(s, 'v1', 'patron_1', "Name's Tam, nobody worth remembering.", { bark: true });
  expect(s.player.journal!.aliases).toEqual({ patron_1: 'Tam' });
  expect(buildPlayerView(s).actors.find((a) => a.id === 'patron_1')?.name).toBe('Tam');
  say(s, 'v2', 'trader', 'Old Wim, you liar, drink your ale.');
  expect(s.player.journal!.namesKnown).toEqual(['patron_1']); // the real name, heard in passing, replaces the false one
  expect(s.player.journal!.aliases).toEqual({});
  const s2 = makeVillage();
  say(s2, 'v1', 'patron_1', "Name's Tam.", { push: { type: 'deceive', listener: 'player', landed: false, tell: true } });
  expect(s2.player.journal!.aliases).toEqual({});
});

