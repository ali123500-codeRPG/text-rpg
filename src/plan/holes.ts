// BW11 a, BW12 a, BW14 a: holes broken through walls. A title's walls are the walls along its sides on its floor, each
// with the title behind it (none: ground not built yet). Breaking one cuts an opening at the spot: halfway (Crippled) a
// crack, seen and heard through, that only an amorphous body passes; done (Destroyed) a gap a doorway's size
// (CONFIG.BREAK_HOLE_M) joining the two titles, or a frontier where nothing is built behind. Holes are openings, so they
// are saved with the place's floor plan like any way.
import type { GameState, Opening, Pt, Wall, Zone } from '../types';
import { CONFIG } from '../config';
import { OP } from '../library/tableIds';
import { freshId } from '../ids';
import { boxOf, dist, lerp, toSegment } from './geom';
import { wallKind } from './walls';
import { zoneAt } from './where';
import { planChanged } from './stamp';

/** how far either side of a wall the titles on its two sides are looked for */
const PROBE_M = 0.3;

/** the titles either side of wall w at point `at` on it (each none where nothing is built) */
function sidesAt(state: GameState, w: Wall, at: Pt): [Zone | undefined, Zone | undefined] {
  const L = dist(w.a, w.b) || 1, nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L;
  return [zoneAt(state, { x: at.x + nx * PROBE_M, y: at.y + ny * PROBE_M }, w.floor), zoneAt(state, { x: at.x - nx * PROBE_M, y: at.y - ny * PROBE_M }, w.floor)];
}
/** the title behind wall w at `at`, seen from title `z` (undefined: unbuilt ground); null when z is on neither side */
export function behindWall(state: GameState, w: Wall, at: Pt, z: Zone): Zone | undefined | null {
  const [p, q] = sidesAt(state, w, at);
  if (p?.id === z.id && q?.id !== z.id) return q;
  if (q?.id === z.id && p?.id !== z.id) return p;
  return null;
}

/** BW12 a: the walls round title z that can be broken (any solid kind), each with the title behind it */
export function wallsAround(state: GameState, z: Zone): { wall: Wall; behind?: Zone }[] {
  if (!z.outline?.length || !Number.isFinite(z.floor)) return [];
  const r = boxOf(z.outline), pad = PROBE_M * 2;
  const out: { wall: Wall; behind?: Zone }[] = [];
  for (const w of state.walls) {
    if (Math.abs(w.floor - z.floor) > 0.01 || wallKind(w.kind)?.none) continue;
    const mid = lerp(w.a, w.b, 0.5);
    if (Math.abs(mid.x - r.x) > r.w / 2 + pad || Math.abs(mid.y - r.y) > r.d / 2 + pad) continue;
    const behind = behindWall(state, w, mid, z);
    if (behind !== null) out.push({ wall: w, ...(behind ? { behind } : {}) });
  }
  return out;
}

/** BW11 a: where on wall w a breaker at p breaks through: the nearest point to them a hole fits, a hole's half width off
 * the wall's ends and clear of the openings already in it (beside a door, never through it); a wall narrower than a hole:
 * its middle. Undefined when no hole fits beside its openings. */
export function holeSpot(state: GameState, w: Wall, p: Pt): Pt | undefined {
  const L = dist(w.a, w.b), half = CONFIG.BREAK_HOLE_M[0] / 2;
  const lo = Math.min(half, L / 2), hi = Math.max(L - half, L / 2);
  const along = (q: Pt) => toSegment(q, w.a, w.b).t * L;
  const taken = state.openings.filter((o) => o.wall === w.id && !o.crack).map((o) => [along(o.at) - o.widthM / 2 - half, along(o.at) + o.widthM / 2 + half]);
  const free = (x: number) => x >= lo - 1e-9 && x <= hi + 1e-9 && taken.every(([a, b]) => x <= a + 1e-9 || x >= b - 1e-9);
  const want = Math.min(hi, Math.max(lo, along(p)));
  const best = [want, ...taken.flat()].filter(free).sort((x, y) => Math.abs(x - want) - Math.abs(y - want))[0];
  return best === undefined ? undefined : lerp(w.a, w.b, L ? best / L : 0.5);
}

/** BW11 a, BW12 a: cuts (or widens) the hole at `at` on wall w: a crack while `crack`, else a full gap. It joins title
 * `from` to the title behind, or to a new frontier (BW12 a: nothing built behind). Returns the opening. */
export function cutHole(state: GameState, w: Wall, at: Pt, from: Zone, crack: boolean, existing?: Opening): Opening {
  planChanged();
  const heightM = Math.min(CONFIG.BREAK_HOLE_M[1], w.top - w.floor);
  if (existing) {
    if (!crack) delete existing.crack;
    existing.widthM = Math.max(existing.widthM, CONFIG.BREAK_HOLE_M[0]); existing.heightM = Math.max(existing.heightM, heightM);
    return existing;
  }
  const behind = behindWall(state, w, at, from) ?? undefined;
  const id = freshId(`${w.placeId}.o`, new Set(state.openings.map((o) => o.id)));
  const o: Opening = {
    id, placeId: w.placeId, kind: OP.gap, at: { ...at }, floor: w.floor, wall: w.id, widthM: CONFIG.BREAK_HOLE_M[0], heightM,
    joins: [from.id, behind?.id ?? `${id}.beyond`], labels: [behind ? `a hole broken through to ${behind.name}` : 'a hole broken through the wall', `a hole broken through to ${from.name}`],
    seeThrough: true, ...(behind ? {} : { frontier: true as const }), ...(crack ? { crack: true as const } : {}),
  };
  state.openings.push(o);
  return o;
}
