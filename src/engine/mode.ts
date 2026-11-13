// Encounter modes and turn start (Architecture step 1).
import type { GameState, Pending } from '../types';
import { countsInFight, foesAfter, isActive, isEngaged, sparring } from './relations';
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

/** BF14/AT61: fight turns only from what the player perceives: an attack on them this turn, a foe after them (isEngaged's
 * foes) they can see or hear just being there, or a fight going on they can see or hear (blows traded, YD6, or a live spar).
 * A foe after them beyond their senses, a standoff or a fight out of their reach keeps normal turns */
export function fightTurns(state: GameState): boolean {
  const p = state.player;
  if (!countsInFight(p)) return false;
  return state.events.some((e) => e.kind === 'attack' && e.target === p.id) || fightInSenses(state);
}
/** AT61/AT65: a foe after the player they can see or hear, or a fight going on between others they can see or hear. The
 * player's own fight is only the first: a foe of theirs gone out of their senses is no fight they can hear (BG-189) */
export function fightInSenses(state: GameState): boolean {
  const p = state.player;
  if (!countsInFight(p)) return false;
  if (foesAfter(state, p).some((o) => perceivesNow(state, p, o, 'faint'))) return true;
  return state.actors.some((a) => countsInFight(a) && state.actors.some((b) => b !== a && (fightingWith(state, a, b) || sparring(state, a, b)))
    && perceivesNow(state, p, a, 'loud'));
}
