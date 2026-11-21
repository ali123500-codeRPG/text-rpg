import { TP } from '../../src/library/templateIds';
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, switchRoutine, desiredState, updateAlarms, alertOrders } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { tick } from '../harness/time';

it('70/71 Wait binds here: told to wait it stays where it switched; an alarm keeps the wait (wait_alert) until DECAY_AWARE_S; told to follow it follows again', () => {
  const s = makeVillage({ playerZone: 'street_door' });
  const c = spawnNpc(null, TP.patron, { id: 'comp', zone: 'street_door', placeId: 'street', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  c.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_door', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  expect(switchRoutine(s, c, 'wait', 'agent')).toBe(true);
  expect(c.mind!.slots!.here).toBe('street_door');
  const anchor = { ...c.mind!.routine! };
  // the player walks on; the companion keeps to its here zone
  c.mind!.knowledge.player = { ...c.mind!.knowledge.player, lastKnownZone: 'gate_inner', lastSeenTurn: s.turn + 2 };
  s.turn = 5;
  expect(desiredState(buildActorView(s, 'comp'))).toEqual({ zone: 'street_door', activity: 'rest' });
  // 71: a fight it hears raises the alarm; it stays where it waits, on watch
  const fight: GameEvent = { id: 'ev_1', turn: 5, actorId: 'slime_1', kind: 'attack', zone: 'field_mid', target: 'player', effects: [], noise: 'normal', visibility: 'normal', perception: { comp: { level: 'partial', cue: 'sound' } } };
  updateAlarms(s, [fight]);
  expect(c.mind!.routine).toEqual({ id: 'wait_alert', anchorTurn: 5, at: 420 });
  expect(desiredState(buildActorView(s, 'comp'))).toEqual({ zone: 'street_door', activity: 'stand_watch' });
  expect(alertOrders(s, [buildActorView(s, 'comp')])).toEqual([]); // companions' onAlert is null
  tick(s, CONFIG.DECAY_AWARE_S - 1);
  updateAlarms(s, []);
  expect(c.mind!.routine!.id).toBe('wait_alert');
  tick(s, 1);
  updateAlarms(s, []);
  expect(c.mind!.routine).toEqual(anchor);
  expect(desiredState(buildActorView(s, 'comp'))!.zone).toBe('street_door');
  expect(switchRoutine(s, c, 'follow', 'agent')).toBe(true);
  expect(desiredState(buildActorView(s, 'comp'))!.zone).toBe('gate_inner');
});
