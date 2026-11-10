// The player's trail: the places it last left, newest first, so the parser can read "go back" or "where I was".
import { CONFIG } from '../config';
import type { GameState } from '../types';
import { perceivedZoneIds } from './relations';

/** record that the player left `from` this turn (no record for staying put or an empty zone id) */
export function noteLeft(state: GameState, from: string): void {
  const p = state.player;
  if (!from || from === p.zone) return;
  const j = (p.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  j.trail = [{ zone: from, left: state.turn }, ...(j.trail ?? []).filter((x) => x.zone !== from)].slice(0, CONFIG.TRAIL_ZONES);
}

/** the Map page's memory: the player's zone and the zones it sees across sight links join journal.zonesSeen (once each) */
export function noteZonesSeen(state: GameState): void {
  const p = state.player;
  if (!p.zone) return;
  const j = (p.journal ??= { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] });
  const seen = (j.zonesSeen ??= []);
  for (const z of perceivedZoneIds(state, p.zone)) if (!seen.includes(z)) seen.push(z);
}
