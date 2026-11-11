// The player's trail: the places it last left, newest first, so the parser can read "go back" or "where I was".
import { CONFIG } from '../config';
import type { GameState } from '../types';
import { perceivedZoneIds, zoneById } from './relations';

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

/** the zones the player knows: stood in or saw across a sight link (zonesSeen), left (the trail), and where it is now;
 * the Map and the Parser's view both read it */
export function knownZoneIds(state: GameState): string[] {
  const j = state.player.journal;
  return [...new Set([state.player.zone, ...(j?.zonesSeen ?? []), ...(j?.trail ?? []).map((t) => t.zone)])].filter((id) => !!zoneById(state, id));
}

/** BG-15: where the player can name a move to: every zone it knows, and every way out of those it has seen (named by the
 * exit's words and where it leads from, for a zone it has never been in), the player's own zone left out */
export function knownDestinations(state: GameState): { id: string; name: string }[] {
  const known = knownZoneIds(state), have = new Set(known);
  const out = known.filter((id) => id !== state.player.zone).map((id) => ({ id, name: zoneById(state, id)!.name }));
  for (const id of known) {
    const z = zoneById(state, id)!;
    for (const l of z.links) if (!l.frontier && !have.has(l.to) && zoneById(state, l.to)) { have.add(l.to); out.push({ id: l.to, name: `${l.label} (from ${z.name})` }); }
  }
  return out;
}
