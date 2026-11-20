// 350 Deck playtest run 13. BG-279: a good look at a slime 23 m off in the dark showed it clearly, then the slime's own step
// later that turn rolled a fresh make-out, failed, and it was "someone" again. BG-280: the deck offered talk, haggling, gifts
// and searches to slimes, those in sight and those last seen far away. BG-281: walking up to someone read "Keep walking to
// the fowlers' path", the zone the player already stood in.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { actor, beside, createRng, makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { lookAround, noteSightings } from '../../src/perception';
import { makeOut } from '../../src/engine/makeOut';
import type { GameEvent } from '../../src/types';
import { setTitleLight } from '../../src/plan/draw';


it('BG-279: a good look keeps a moving slime seen for the rest of the turn', () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night;
  for (const z of s.zones) setTitleLight(s, z, 'dark');
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

