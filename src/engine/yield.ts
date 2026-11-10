// The player's yield in a real fight (MB40–MB43). In a spar, "I yield" still just leaves the spar (SP5).
// Every foe fighting the player answers: one run by Claude, of an Intelligent race, decides in its next output
// (acceptYield); the rest ignore it and fight on. An accepted yield is a truce until the scene ends: neither is hostile
// to the other, neither can attack the other (MB43), and the fight counts as lost (defeated).
import type { Actor, GameState } from '../types';
import { INTELLIGENCE } from '../scales';
import { getLibrary } from '../library';
import { logCode } from './effects';
import { countsInFight, hostile, isActive } from './relations';
export { truce } from './relations';

/** a Claude-run foe of an Intelligent race can take a yield (MB41) */
function canAccept(a: Actor): boolean {
  const mind = a.core.raceId ? getLibrary().races?.[a.core.raceId]?.intelligence : undefined;
  return a.mind?.control === 'agent' && !!mind && INTELLIGENCE.pos(mind) >= INTELLIGENCE.pos('intelligent');
}

/** MB40: the player yields to every foe fighting them that has not answered an earlier yield this scene */
export function playerYields(state: GameState): void {
  const p = state.player;
  const y = (state.yielding ??= { turn: state.turn, pending: [], accepted: [], refused: [] });
  const asked = new Set([...y.pending, ...y.accepted, ...y.refused]);
  const foes = state.actors.filter((a) => isActive(a) && countsInFight(a) && !asked.has(a.id) && hostile(state, a, p));
  if (!foes.length) return logCode(state, 'invalid_yield', { actorId: p.id });
  for (const a of foes) (canAccept(a) ? y.pending : y.refused).push(a.id);
  y.turn = state.turn;
  logCode(state, 'player_yielded', { pending: y.pending, refused: y.refused });
}

/** MB41: a foe asked by the player's yield answers in its next output; no answer is a refusal */
export function answerYield(state: GameState, a: Actor, accept: boolean | undefined): void {
  const y = state.yielding;
  if (!y || !y.pending.includes(a.id) || y.turn >= state.turn) return; // answers come the turn after the yield
  y.pending = y.pending.filter((id) => id !== a.id);
  (accept ? y.accepted : y.refused).push(a.id);
  logCode(state, accept ? 'yield_accepted' : 'yield_refused', { actorId: a.id });
}

/** MB43: once yielded, the player cannot attack a foe that took the yield or has yet to answer it, and a foe that took it cannot attack the player */
export function yieldBars(state: GameState, a: Actor, t: Actor): boolean {
  const y = state.yielding;
  if (!y) return false;
  if (a === state.player) return y.accepted.includes(t.id) || y.pending.includes(t.id);
  return t === state.player && y.accepted.includes(a.id);
}
/** the player yielded and a foe took it: the fight is lost (MB42) */
export const yieldTaken = (state: GameState): boolean => !!state.yielding?.accepted.length;
