import { expect, expectTypeOf, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { desiredState, installRoutines } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('64 Anchor from startAt: the actor starts at the first route stop; the plan holds no anchorTurn', () => {
  const s = makeVillage();
  s.turn = 40;
  const g = actor(s, 'guard_1');
  installRoutines(g, 'patrol_guard', { route: ['street_square', 'gate_inner', 'street_door'] }, 'route', s.turn, createRng(1));
  expect(desiredState(buildActorView(s, 'guard_1'))!.zone).toBe('street_square');
  // startAt a later slot: the anchor is backdated over the steps before it
  const sl = actor(s, 'slime_1');
  installRoutines(sl, 'slime_wander', { route: ['field_mid', 'field_far'], post: 'field_edge' }, 'post', s.turn, createRng(1));
  expect(desiredState(buildActorView(s, 'slime_1'))).toEqual({ zone: 'field_edge', activity: 'rest' });
  type Cast = StagePlan['cast'][number];
  expectTypeOf<Cast>().toHaveProperty('startAt');
  expectTypeOf<'anchorTurn' extends keyof Cast ? true : false>().toEqualTypeOf<false>();
});
