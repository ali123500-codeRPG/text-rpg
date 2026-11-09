import { TP } from '../../src/library/templateIds';
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, switchRoutine, desiredState, updateAlarms, alertOrders } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('71 Alert keeps the wait: wait_alert in the same zone, back to wait after DECAY_TURNS', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const c = spawnNpc(null, TP.patron, { id: 'comp', zone: 'field_edge', placeId: 'field', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  switchRoutine(s, c, 'wait', 'agent');
  const anchor = c.mind!.routine!.anchorTurn;
  s.turn = 5;
  const fight: GameEvent = { id: 'ev_1', turn: 5, actorId: 'slime_1', kind: 'attack', zone: 'field_mid', target: 'player', effects: [], noise: 'normal', visibility: 'normal', perception: { comp: { level: 'partial', cue: 'sound' } } };
  updateAlarms(s, [fight]);
  expect(c.mind!.routine).toEqual({ id: 'wait_alert', anchorTurn: 5 });
  expect(desiredState(buildActorView(s, 'comp'))).toEqual({ zone: 'field_edge', activity: 'stand_watch' });
  expect(alertOrders(s, [buildActorView(s, 'comp')])).toEqual([]); // companions' onAlert is null
  for (s.turn = 6; s.turn < 5 + CONFIG.DECAY_TURNS; s.turn++) updateAlarms(s, []);
  expect(c.mind!.routine!.id).toBe('wait_alert');
  updateAlarms(s, []);
  expect(c.mind!.routine).toEqual({ id: 'wait', anchorTurn: anchor });
  expect(desiredState(buildActorView(s, 'comp'))!.zone).toBe('field_edge');
});
