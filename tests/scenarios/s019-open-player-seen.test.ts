import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { detectPlayer } from '../../src/minds';

it('19 Open player is seen: full → aware, partial → suspicious, with no check or roll', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  s.actors.push(spawnNpc(null, 'guard', { id: 'guard_2', zone: 'street_door', placeId: 'street', bandId: 'village_watch' }));
  place(s, 'guard_1', 'gate_inner');
  const event: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'player', kind: 'interact', zone: 'street_square', effects: [], noise: 'quiet', visibility: 'normal',
    perception: { guard_1: { level: 'full', cue: 'sight' }, guard_2: { level: 'partial', cue: 'sound' } },
  };
  const rng = createRng(99);
  const before = rng.state;
  detectPlayer(s, event, rng);
  expect(rng.state).toBe(before); // no roll
  expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
  expect(actor(s, 'guard_2').mind!.knowledge.player.status).toBe('suspicious');
});
