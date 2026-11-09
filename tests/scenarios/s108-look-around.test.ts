// 108 Look around (Ali, 07/11/2026, Q17): looking is a sight roll; Success or better shows everyone in sight clearly,
// and someone seen clearly stays seen until they move.
import { expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { computePending } from '../../src/engine';
import { lookAround, noteSightings, perceptionOf } from '../../src/perception';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

const ev = (s: GameState, actorId: string, kind: string, zone: string, visibility: GameEvent['visibility'] = 'low'): GameEvent =>
  ({ id: `x${kind}`, turn: s.turn, actorId, kind, zone, effects: [], noise: 'silent', visibility, perception: {} }) as GameEvent;

it('108 a clear look keeps a still figure seen until it moves', () => {
  const s = makeVillage();
  const hold = ev(s, 'trader', 'hold', 'tav_counter');
  expect(perceptionOf(hold, s, s.player)?.level).toBe('partial'); // sitting still one zone away: a shape
  expect(lookAround(s)).toContain('trader');
  expect(perceptionOf(hold, s, s.player)?.level).toBe('full'); // seen, and stays seen while it stays put
  const left = { ...ev(s, 'trader', 'move', 'tav_cellar'), perception: {} };
  actor(s, 'trader').zone = 'tav_cellar';
  noteSightings(left, s); // moved where the player could not see clearly: forgotten
  actor(s, 'trader').zone = 'tav_counter';
  expect(perceptionOf(hold, s, s.player)?.level).toBe('partial');
});

it('108 looking around is a sight roll on the player\'s event', () => {
  const s = makeVillage();
  s.turn = 0;
  computePending(s);
  const events = play(s, { intent: intent({ action: { type: 'observe', skill: SK.eyesight } }) });
  const look = events.find((e) => e.actorId === 'player' && e.roll);
  expect(look?.roll).toMatchObject({ actorId: 'player', skill: SK.eyesight });
  expect(look?.check).toBeUndefined();
});
