import { TP } from '../../src/library/templateIds';
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, updateAlarms, desiredState } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { tick, turnsFor } from '../harness/time';
import { CONFIG } from '../../src/config';

it('72 Calm return in phase: alarmed on turn 10, calm on turn 16, back to work with the original anchor', () => {
  const s = makeVillage();
  s.turn = 3;
  const w = spawnNpc(null, TP.patron, { id: 'worker', zone: 'street_square', placeId: 'street', bandId: 'tavern_folk', name: 'Hobb' });
  installRoutines(w, 'street_worker', { work: 'street_square', refuge: 'street_door' }, undefined, s.turn, createRng(8));
  s.actors.push(w);
  const original = { ...w.mind!.routine! };
  expect(original.id).toBe('work_shift');
  s.turn = 10;
  const attack: GameEvent = { id: 'ev_1', turn: 10, actorId: 'slime_1', kind: 'attack', zone: 'street_square', target: 'guard_1', effects: [], noise: 'normal', visibility: 'normal', perception: { worker: { level: 'full', cue: 'sight' } } };
  updateAlarms(s, [attack]);
  expect(w.mind!.routine).toEqual({ id: 'flee_to_refuge_alert', anchorTurn: 10, at: 420 });
  expect(desiredState(buildActorView(s, 'worker'))!.zone).toBe('street_door');
  for (let i = 1; i < turnsFor(CONFIG.DECAY_AWARE_S, 60); i++) {
    tick(s, 60);
    updateAlarms(s, []);
    expect(w.mind!.routine!.id).toBe('flee_to_refuge_alert');
  }
  tick(s, 60);
  updateAlarms(s, []);
  expect(w.mind!.routine).toEqual(original);
});
