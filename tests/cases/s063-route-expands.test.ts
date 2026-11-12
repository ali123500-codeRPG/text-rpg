import { expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { desiredState, installRoutines } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('63 Route expands: each stop in order for the step duration, then loops', () => {
  const s = makeVillage();
  const route = ['gate_inner', 'street_square', 'street_door'];
  installRoutines(actor(s, 'guard_1'), 'patrol_guard', { route }, 'route', 0, createRng(1));
  const zones: string[] = [];
  // NW10: on the clock, every 10 game minutes for two hours: short = 30 minutes per stop, a 90-minute loop
  for (let m = 0; m < 120; m += 10) { s.clocks.time = 420 + m; zones.push(desiredState(buildActorView(s, 'guard_1'))!.zone); }
  expect(zones).toEqual([...route.flatMap((z) => [z, z, z]), 'gate_inner', 'gate_inner', 'gate_inner']);
});
