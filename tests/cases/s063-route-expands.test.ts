import { expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { desiredState, installRoutines } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('63 Route expands: each stop in order for the step duration, then loops', () => {
  const s = makeVillage();
  const route = ['gate_inner', 'street_square', 'street_door'];
  installRoutines(actor(s, 'guard_1'), 'patrol_guard', { route }, 'route', 0, createRng(1));
  const zones: string[] = [];
  for (s.turn = 0; s.turn < 12; s.turn++) zones.push(desiredState(buildActorView(s, 'guard_1'))!.zone);
  // short = 3 turns per stop, 9-turn loop
  expect(zones).toEqual([...route.flatMap((z) => [z, z, z]), 'gate_inner', 'gate_inner', 'gate_inner']);
});
