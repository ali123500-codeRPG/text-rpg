// Encounter modes and turn start (Architecture step 1).
import type { GameState, Pending } from '../types';
import { allActors, countsInFight, isActive, isEngaged, sparring } from './relations';
import { fireTurnStartTriggers } from './triggers';
import { fightingWith } from './engagement';
import { perceivesNow } from './yield';

/** engaged significant and minor actors (side-neutral), in actor-id order. */
export function engagedActors(state: GameState): string[] {
  return state.actors.filter((a) => isActive(a) && isEngaged(state, a)).map((a) => a.id).sort();
}

/**
 * After turn state.turn is saved: compute turn state.turn + 1. Fires turn-start triggers (firedLog, once removal),
 * keeps the bound orders in state.scratch for firedOrders(state), and sets state.pending.
 * Mode (BF14): tactical while a fight concerns the player (fightTurns), else explore; dialogue is decided after the Parser.
 * engaged (who gets a Planner call) still counts everyone suspicious of a foe, wherever they are.
 */
export function computePending(state: GameState): Pending {
  const turn = state.turn + 1;
  const { orders, fired } = fireTurnStartTriggers(state, turn);
  state.scratch = { ...(state.scratch ?? {}), firedOrders: orders };
  const engaged = engagedActors(state);
  const pending: Pending = { turn, mode: fightTurns(state) ? 'tactical' : 'explore', engaged, fired };
  state.pending = pending;
  return pending;
}

/** BF14: fight turns only when a fight concerns the player: someone fighting them knows they are there (isEngaged), or they
 * can perceive a fight going on (blows traded, YD6, or a live spar). A standoff or a fight beyond their senses keeps normal turns */
export function fightTurns(state: GameState): boolean {
  const p = state.player;
  if (isEngaged(state, p)) return true;
  return state.actors.some((a) => countsInFight(a) && allActors(state).some((b) => b !== a && (fightingWith(state, a, b) || sparring(state, a, b)))
    && perceivesNow(state, p, a, 'loud'));
}
