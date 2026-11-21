// Encounter modes and turn start (Architecture step 1).
import type { GameState, Pending } from '../types';
import { actorById, countsInFight, foesAfter, isActive, isEngaged, sparring } from './relations';
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
  // only a pair one of whom holds the other as engaged, or on two sides of a live spar, can be fighting: those are the
  // pairs tried, in place of every pair of actors
  const near = fightCandidates(state);
  return state.actors.some((a) => countsInFight(a) && [...(near.get(a.id) ?? [])].some((id) => {
    const b = actorById(state, id);
    return !!b && b !== a && b !== p && (fightingWith(state, a, b) || sparring(state, a, b));
  }) && perceivesNow(state, p, a, 'loud'));
}
/** for each NPC, the NPCs it could be fighting: either side holding the other as engaged (fightingWith needs engagedPair),
 * or the two on different sides of a spar (sparring) */
function fightCandidates(state: GameState): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (x: string, y: string) => { (out.get(x) ?? out.set(x, new Set()).get(x)!).add(y); (out.get(y) ?? out.set(y, new Set()).get(y)!).add(x); };
  for (const a of state.actors) {
    const k = a.mind?.knowledge;
    if (k) for (const id in k) if (k[id].status === 'engaged') add(a.id, id);
  }
  for (const sp of state.spars ?? []) sp.sides.forEach((side, i) => sp.sides.slice(i + 1).forEach((other) => side.forEach((x) => other.forEach((y) => add(x, y)))));
  return out;
}
