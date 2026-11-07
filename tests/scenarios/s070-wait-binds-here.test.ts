import { expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, switchRoutine, desiredState } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('70 Wait binds here: told to wait it stays where it switched; told to follow it follows again', () => {
  const s = makeVillage({ playerZone: 'street_door' });
  const c = spawnNpc(null, 'patron', { id: 'comp', zone: 'street_door', placeId: 'street', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  c.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_door', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  expect(switchRoutine(s, c, 'wait', 'agent')).toBe(true);
  expect(c.mind!.slots!.here).toBe('street_door');
  // the player walks on; the companion keeps to its here zone
  c.mind!.knowledge.player = { ...c.mind!.knowledge.player, lastKnownZone: 'gate_inner', lastSeenTurn: s.turn + 2 };
  s.turn += 2;
  expect(desiredState(buildActorView(s, 'comp'))).toEqual({ zone: 'street_door', activity: 'rest' });
  expect(switchRoutine(s, c, 'follow', 'agent')).toBe(true);
  expect(desiredState(buildActorView(s, 'comp'))!.zone).toBe('gate_inner');
});
