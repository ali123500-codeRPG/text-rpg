// WZ18 the next region: drawn when the player can see past their region's edge (WZ17 sight) or stands on a road that
// leaves by it, and joined to every drawn neighbour so its roads, rivers, streams and ground run on across the edge.
import type { GameState, Region, Side } from '../types';
import { OPP_SIDE, SIDE_STEP, SIDES } from '../types';
import { zoneById } from '../engine/relations';
import type { EdgeJoin } from './generate';
import { landSightM, regionAt } from './sight';

const drawn = (state: GameState, gx: number, gy: number) => state.regions?.find((r) => r.gx === gx && r.gy === gy);

/** the squares beside the player's region that should be drawn now: one whose edge is in sight from where the player
 * stands outdoors, or that the road the player is on leaves toward */
export function squaresWanted(state: GameState): { gx: number; gy: number }[] {
  const p = state.player, z = zoneById(state, p.zone);
  const at = p.pos ?? (z?.rect ? { x: z.rect.x, y: z.rect.y } : undefined);
  const r = at && regionAt(state, at);
  if (!r || !z) return [];
  const sides = new Set<Side>();
  if (z.outdoor) {
    const S = r.size, x0 = r.gx * S, y0 = r.gy * S, reach = landSightM();
    const gap: Record<Side, number> = { n: y0 + S - at.y, s: at.y - y0, e: x0 + S - at.x, w: at.x - x0 };
    for (const sd of SIDES) if (gap[sd] < reach) sides.add(sd);
  }
  const line = z.road ? r.roads.find((x) => x.id === z.road) : undefined;
  for (const end of line?.ends ?? []) { const n = r.nodes.find((x) => x.id === end); if (n?.kind === 'edge' && n.side) sides.add(n.side); }
  return [...sides].map((sd) => ({ gx: r.gx + SIDE_STEP[sd][0], gy: r.gy + SIDE_STEP[sd][1] })).filter((q) => !drawn(state, q.gx, q.gy));
}

/** what the drawn neighbours of square gx, gy fix on their shared edges, from the new region's side */
export function joinsFor(state: GameState, gx: number, gy: number): EdgeJoin[] {
  return SIDES.flatMap((side): EdgeJoin[] => {
    const nb = drawn(state, gx + SIDE_STEP[side][0], gy + SIDE_STEP[side][1]);
    return nb ? [joinOf(nb, OPP_SIDE[side], side)] : [];
  });
}

/** neighbour `nb`'s edge on its side `edge`, as seen from the new region, whose side `side` it is */
function joinOf(nb: Region, edge: Side, side: Side): EdgeJoin {
  const S = nb.size, C = nb.cell, N = Math.round(S / C), x0 = nb.gx * S, y0 = nb.gy * S;
  const ns = edge === 'n' || edge === 's';
  const gapTo = (p: { x: number; y: number }) => (edge === 'n' ? y0 + S - p.y : edge === 's' ? p.y - y0 : edge === 'e' ? x0 + S - p.x : p.x - x0);
  const along = (p: { x: number; y: number }) => Math.max(0, Math.min(S, ns ? p.x - x0 : p.y - y0));
  const roads = nb.nodes.filter((n) => n.kind === 'edge' && n.side === edge).map((n) => along(n.at));
  const waters = nb.waters.flatMap((w) => {
    const first = w.pts[0], last = w.pts[w.pts.length - 1];
    // water that ends at the shared edge flows on into the new region; water that starts there came from it
    if (gapTo(last) <= C) return [{ at: along(last), width: w.width, kind: w.kind, name: w.name, out: false }];
    if (w.kind === 'river' && gapTo(first) <= C) return [{ at: along(first), width: w.width, kind: w.kind, name: w.name, out: true }];
    return [];
  });
  const row = edge === 'n' ? N - 1 : 0, col = edge === 'e' ? N - 1 : 0;
  const heights = Array.from({ length: N }, (_, k) => nb.heights[ns ? row * N + k : k * N + col]);
  return { side, roads, waters, heights };
}
