// Encounter modes and turn start (Architecture step 1).
import type { GameState, Pending } from '../types';
import { isActive, isEngaged } from './relations';
import { fireTurnStartTriggers } from './triggers';

/** engaged significant and minor actors (side-neutral), in actor-id order. */
export function engagedActors(state: GameState): string[] {
  return state.actors.filter((a) => isActive(a) && isEngaged(state, a)).map((a) => a.id).sort();
}

/**
 * After turn state.turn is saved: compute turn state.turn + 1. Fires turn-start triggers (firedLog, once removal),
 * keeps the bound orders in state.scratch for firedOrders(state), and sets state.pending.
 * Mode: tactical if any engaged actor, else explore; dialogue is decided after the Parser.
 */
export function computePending(state: GameState): Pending {
  const turn = state.turn + 1;
  const { orders, fired } = fireTurnStartTriggers(state, turn);
  state.scratch = { ...(state.scratch ?? {}), firedOrders: orders };
  const engaged = engagedActors(state);
  const pending: Pending = { turn, mode: engaged.length ? 'tactical' : 'explore', engaged, fired };
  state.pending = pending;
  return pending;
}
