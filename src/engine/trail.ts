// The player's trail: the places it last left, newest first, so the parser can read "go back" or "where I was".
import { CONFIG } from '../config';
import type { GameState } from '../types';

/** record that the player left `from` this turn (no record for staying put or an empty zone id) */
export function noteLeft(state: GameState, from: string): void {
  const p = state.player;
  if (!from || from === p.zone) return;
  const j = (p.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  j.trail = [{ zone: from, left: state.turn }, ...(j.trail ?? []).filter((x) => x.zone !== from)].slice(0, CONFIG.TRAIL_ZONES);
}
