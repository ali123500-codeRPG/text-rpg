// WI8 a: the stage keeps no list of zones. Every built zone in the world is live for every system; only what a planner or
// an NPC agent is shown is bounded, by nearbyZones.
import { waysOut } from '../plan/where';
import type { GameState, Zone } from '../types';
import { zoneById } from '../engine/relations';
import { distOrNull } from '../engine/position';
import { CONFIG } from '../config';

/** unbuilt frontier keys linked from the player's zone */
export function frontiersNearPlayer(state: GameState): string[] {
  const z = zoneById(state, state.player.zone);
  const out: string[] = [];
  for (const l of z ? waysOut(state, z.id) : []) if (l.frontier && !out.includes(l.to)) out.push(l.to);
  return out;
}

/** the top-level place over `placeId` (itself when it has no parent) */
export function topPlace(state: GameState, placeId: string): string | undefined {
  let p = state.places.find((x) => x.id === placeId);
  for (let n = 0; p?.parentId && n < 20; n++) p = state.places.find((x) => x.id === p!.parentId) ?? p;
  return p?.id;
}

/** WI8 a: the ground shown to a planner or an agent: every zone of the settlement or road (top-level place) over each of
 * `places`, and every zone within PLAN_VIEW_M metres of `origins` by the walking path (BG-305), in world order */
export function nearbyZones(state: GameState, origins: string[], places: string[]): Zone[] {
  const roots = new Set(places.map((p) => topPlace(state, p)).filter(Boolean));
  const out = new Set<string>();
  for (const p of state.places) if (roots.has(topPlace(state, p.id))) for (const z of p.zones) out.add(z.id);
  const from = origins.filter((z) => zoneById(state, z));
  for (const z of state.zones) if (!out.has(z.id) && from.some((o) => (distOrNull(state, { zone: o }, { zone: z.id }) ?? Infinity) <= CONFIG.PLAN_VIEW_M)) out.add(z.id);
  return state.zones.filter((z) => out.has(z.id));
}
