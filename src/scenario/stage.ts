// WI8 a: the stage keeps no list of zones. Every built zone in the world is live for every system; only what a planner or
// an NPC agent is shown is bounded, by nearbyZones, in metres from the points that matter.
import { waysOut } from '../plan/where';
import { nearestEdge } from '../plan/geom';
import type { GameState, Zone } from '../types';
import { zoneById } from '../engine/relations';
import { inside, pathM, wayLeftM, type Located } from '../engine/position';
import { CONFIG } from '../config';

/** unbuilt frontier keys linked from the player's zone */
export function frontiersNearPlayer(state: GameState): string[] {
  const z = zoneById(state, state.player.zone);
  const out: string[] = [];
  for (const l of z ? waysOut(state, z.id) : []) if (l.frontier && !out.includes(l.to)) out.push(l.to);
  return out;
}

/** BG-1615: metres from point `f` to title `z`'s nearest point by the walking path: 0 standing in it, else the walk to
 * where it gets in (wayLeftM), or failing that to its middle; Infinity with no walk, or when even the straight line to
 * its nearest edge is past `limit` (a walk is never shorter) */
function walkInM(state: GameState, f: Located, z: Zone, limit: number): number {
  if (!z.outline?.length || !f.pos) return Infinity;
  if (f.zone === z.id || inside(z, f.pos)) return 0;
  if (nearestEdge(f.pos, z.outline).d > limit) return Infinity;
  try { return wayLeftM(state, f, z.id, undefined, true) ?? pathM(state, f, { zone: z.id }); } catch { return Infinity; }
}

/** WI8 a: the ground shown to a planner or an agent: every title whose nearest point lies within PLAN_VIEW_M metres of
 * one of the points `from` by the walking path (BG-305, BG-1615: never a whole place by its title), in world order */
export function nearbyZones(state: GameState, from: Located[]): Zone[] {
  const pts = from.filter((f) => f.pos && zoneById(state, f.zone));
  return state.zones.filter((z) => pts.some((f) => walkInM(state, f, z, CONFIG.PLAN_VIEW_M) <= CONFIG.PLAN_VIEW_M));
}
