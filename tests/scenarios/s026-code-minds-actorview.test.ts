import { expect, expectTypeOf, it } from 'vitest';
import type { ActorView, GameState, Order, Rng } from '../../src/types';
import { desiredState, routineOrder, fallbackOrder, brokenOrder } from '../../src/minds';
import { makeVillage, createRng } from '../harness';

it('26 Code minds read ActorView only (type-level)', () => {
  expectTypeOf(desiredState).parameters.toEqualTypeOf<[ActorView]>();
  expectTypeOf(routineOrder).parameters.toEqualTypeOf<[ActorView]>();
  expectTypeOf(brokenOrder).parameters.toEqualTypeOf<[ActorView]>();
  expectTypeOf(fallbackOrder).parameters.toEqualTypeOf<[ActorView, Rng]>();
  expectTypeOf(routineOrder).returns.toEqualTypeOf<Order>();
  expectTypeOf<GameState>().not.toMatchTypeOf<ActorView>();
  const s: GameState = makeVillage();
  const never = () => {
    // @ts-expect-error a GameState is not an ActorView
    desiredState(s);
    // @ts-expect-error a GameState is not an ActorView
    routineOrder(s);
    // @ts-expect-error a GameState is not an ActorView
    fallbackOrder(s, createRng(1));
    // @ts-expect-error a GameState is not an ActorView
    brokenOrder(s);
  };
  expect(typeof never).toBe('function');
});
