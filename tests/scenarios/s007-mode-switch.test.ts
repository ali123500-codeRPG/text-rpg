// 7 Mode switch: Explore has no engaged actor (so no Planner call); the first opposed actor who becomes
// suspicious switches the next turn to Tactical, and only that actor is engaged (the pipeline gives Planner calls to pending.engaged).
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { computePending } from '../../src/engine';
import { intent, play } from './w4-kit';

it('7 Mode switch', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  actor(s, 'guard_1').mind!.overrides = { player: 'opposed' };
  s.turn = 0;
  expect(computePending(s)).toMatchObject({ turn: 1, mode: 'explore', engaged: [] });
  play(s, { intent: intent({ move: { toZone: 'gate_inner' } }) }); // an open player walks into the guard's view
  expect(s.pending).toMatchObject({ turn: 2, mode: 'tactical', engaged: ['guard_1'] });
});
