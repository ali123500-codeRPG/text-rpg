// 350 Deck playtest run 13. BG-279: a good look at a slime 23 m off in the dark showed it clearly, then the slime's own step
// later that turn rolled a fresh make-out, failed, and it was "someone" again. BG-280: the deck offered talk, haggling, gifts
// and searches to slimes, those in sight and those last seen far away. BG-281: walking up to someone read "Keep walking to
// the fowlers' path", the zone the player already stood in.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { actor, beside, createRng, makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { lookAround, noteSightings } from '../../src/perception';
import { makeOut } from '../../src/engine/makeOut';
import type { GameEvent } from '../../src/types';

const targets = (s: ReturnType<typeof makeVillage>, kind: string): string[] => {
  const step = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions).find((a) => a.kind === kind)?.steps[0];
  return step && 'picks' in step && step.picks ? step.picks({}).map((p) => p.id) : [];
};

it('BG-279: a good look keeps a moving slime seen for the rest of the turn', () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night;
  for (const z of s.zones) z.light = 'dark';
  beside(s, 'slime_1', 'player', 4);
  expect(buildPlayerView(s).actors.find((a) => a.id === 'slime_1')?.level).toBe('partial');
  expect(lookAround(s)).toContain('slime_1');
  const sl = actor(s, 'slime_1');
  const step: GameEvent = { id: `t${s.turn}.9`, turn: s.turn, actorId: sl.id, kind: 'move', zone: sl.zone, pos: sl.pos, effects: [], noise: 'quiet',
    visibility: 'normal', perception: { player: { level: 'partial', cue: 'sight' } } } as GameEvent;
  makeOut(s, step, createRng(1));
  expect(step.perception.player.level).toBe('full'); // no fresh roll: the look already made it out this turn
  expect(step.madeOut).toBeUndefined();
  noteSightings(step, s);
  expect(buildPlayerView(s).actors.find((a) => a.id === 'slime_1')?.level).toBe('full');
});

it('BG-280: a slime seen clearly, or last seen far off, gets no talk, trade, gift or search but can be threatened; a person gets all', () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  beside(s, 'slime_1', 'player', 1);
  beside(s, 'guard_1', 'player', 1.5);
  const pv = buildPlayerView(s);
  expect(pv.actors.find((a) => a.id === 'slime_1')).toMatchObject({ level: 'full', mute: true });
  expect(pv.actors.find((a) => a.id === 'guard_1')?.mute).toBeUndefined();
  for (const kind of ['talk', 'persuade', 'deceive', 'barter', 'give', 'lets_search']) {
    expect(targets(s, kind)).not.toContain('slime_1');
    expect(targets(s, kind)).toContain('guard_1');
  }
  expect(targets(s, 'attack')).toContain('slime_1');
  expect(targets(s, 'intimidate')).toContain('slime_1'); // BF86: a threat can be without words
  // last seen elsewhere: the guard can be called on, the slime cannot
  s.player.journal!.lastKnown = { slime_1: 'field_mid', guard_1: 'field_mid' };
  for (const id of ['slime_1', 'guard_1']) { actor(s, id).zone = 'field_mid'; actor(s, id).placeId = 'field'; actor(s, id).pos = undefined; }
  const last = buildPlayerView(s).lastSeen ?? [];
  expect(last.find((x) => x.id === 'slime_1')?.mute).toBe(true);
  expect(targets(s, 'talk')).not.toContain('slime_1');
});

it('BG-281: a walk up to someone is named by them, not by the zone', () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'] });
  const g = beside(s, 'guard_1', 'player', 8);
  s.player.walking = { toZone: g.zone, spot: { near: g.id } } as typeof s.player.walking;
  const pv = buildPlayerView(s);
  const shown = pv.actors.find((a) => a.id === g.id)!;
  expect(pv.player.walking?.to).toBe(shown.name ?? shown.label);
  expect(deck({ pv, s }).flatMap((x) => x.actions).find((a) => a.kind === 'keep_walking')?.label).toBe(`Keep walking to ${shown.name ?? shown.label}`);
});
