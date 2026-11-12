import { afterEach, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import { desiredState, installRoutines } from '../../src/minds';
import { buildActorView } from '../../src/views';

afterEach(() => resetConfig());

it('66 Durations are ids: changing DURATIONS.short changes every short step, with no bank edit', () => {
  const bank = JSON.stringify(getLibrary().routines);
  const s = makeVillage();
  installRoutines(actor(s, 'guard_1'), 'patrol_guard', { route: ['gate_inner', 'street_square'] }, 'route', 0, createRng(1));
  const zoneAt = (t: number) => { s.turn = t; return desiredState(buildActorView(s, 'guard_1'))!.zone; };
  expect(zoneAt(3)).toBe('street_square');
  CONFIG.DURATIONS.short = 5;
  expect(zoneAt(3)).toBe('gate_inner');
  expect(zoneAt(5)).toBe('street_square');
  // roam_field's short ooze step changes too
  actor(s, 'slime_1').mind!.routine = { id: 'roam_field', anchorTurn: 0 };
  s.turn = 4;
  expect(desiredState(buildActorView(s, 'slime_1'))).toEqual({ zone: 'field_mid', activity: 'ooze' });
  expect(JSON.stringify(getLibrary().routines)).toBe(bank);
});
