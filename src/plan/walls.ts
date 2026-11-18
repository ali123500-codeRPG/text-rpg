// PZ2 a: painting walls on the floor plan. A side drawn where a wall already stands on that floor is one wall, of the more
// closed of the two kinds; the rest of the side is new wall. Openings keep their wall when a wall is split.
import type { GameState, Opening, Pt, Wall } from '../types';
import { getLibrary } from '../library';
import { WK } from '../library/tableIds';
import { CONFIG } from '../config';
import { dist, GEO_EPS, NEAR_M, toSegment } from './geom';
import { planChanged } from './stamp';

/** how closed a wall kind is: a wall most, then glazed, an arcade, a low wall, a fence; open (no wall) least */
const RANK: Record<string, number> = { [WK.wall]: 5, [WK.glazed]: 4, [WK.arcade]: 3, [WK.low]: 2, [WK.fence]: 1, [WK.open]: 0 };
export const wallRank = (kind: string): number => RANK[kind] ?? 5;
/** the wall kind's row (an unknown kind reads as a wall) */
export const wallKind = (kind: string) => getLibrary().wallKinds?.[kind] ?? getLibrary().wallKinds?.[WK.wall];
/** how high a wall of this kind stands above its floor, under a ceiling at `top` */
export const wallTop = (kind: string, floor: number, top: number): number => {
  const h = wallKind(kind)?.heightM;
  return h === undefined ? top : Math.min(top, floor + h);
};

let seq = 0;
const freshWallId = (state: GameState, placeId: string): string => {
  const taken = new Set(state.walls.map((w) => w.id));
  let id = '';
  do id = `${placeId}.w${++seq}`; while (taken.has(id));
  return id;
};

/** the share along wall w of point p, and how far p lies off its line */
function onWall(w: Wall, p: Pt): { s: number; off: number } {
  const L = dist(w.a, w.b) || 1, ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
  return { s: (p.x - w.a.x) * ux + (p.y - w.a.y) * uy, off: Math.abs((p.x - w.a.x) * uy - (p.y - w.a.y) * ux) };
}

/** PZ2: paints a wall of `kind` from a to b on `floor` (up to the ceiling `top`): where walls already stand along it, the
 * more closed kind wins there; elsewhere a new wall. An open kind paints nothing. Returns the walls along a–b after. */
export function paintWall(state: GameState, placeId: string, a: Pt, b: Pt, floor: number, ceiling: number, kind: string): Wall[] {
  const L = dist(a, b);
  if (L < NEAR_M || wallKind(kind)?.none) return [];
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const at = (s: number): Pt => ({ x: a.x + ux * s, y: a.y + uy * s });
  const along = (p: Pt) => (p.x - a.x) * ux + (p.y - a.y) * uy;
  const offLine = (p: Pt) => Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
  const covered: [number, number][] = [];
  for (const w of [...state.walls]) {
    if (Math.abs(w.floor - floor) > 0.01 || offLine(w.a) > NEAR_M || offLine(w.b) > NEAR_M) continue;
    const s0 = Math.max(0, Math.min(along(w.a), along(w.b))), s1 = Math.min(L, Math.max(along(w.a), along(w.b)));
    if (s1 - s0 <= NEAR_M) continue;
    covered.push([s0, s1]);
    if (wallRank(kind) > wallRank(w.kind)) splitWall(state, w, at(s0), at(s1), kind, wallTop(kind, floor, ceiling));
  }
  covered.sort((x, y) => x[0] - y[0]);
  const gaps: [number, number][] = [];
  let s = 0;
  for (const [c0, c1] of covered) { if (c0 - s > NEAR_M) gaps.push([s, c0]); s = Math.max(s, c1); }
  if (L - s > NEAR_M) gaps.push([s, L]);
  const top = wallTop(kind, floor, ceiling);
  planChanged();
  for (const [g0, g1] of gaps) state.walls.push({ id: freshWallId(state, placeId), placeId, a: at(g0), b: at(g1), floor, top, kind, thicknessM: CONFIG.WALL_THICKNESS_M });
  return state.walls.filter((w) => Math.abs(w.floor - floor) <= 0.01 && offLine(w.a) <= NEAR_M && offLine(w.b) <= NEAR_M);
}

/** the part of wall w between p and q (points on its line) becomes `kind`; the rest keeps its own; openings follow */
function splitWall(state: GameState, w: Wall, p: Pt, q: Pt, kind: string, top: number): void {
  const L = dist(w.a, w.b);
  let s0 = onWall(w, p).s, s1 = onWall(w, q).s;
  if (s0 > s1) [s0, s1] = [s1, s0];
  s0 = Math.max(0, s0); s1 = Math.min(L, s1);
  const pt = (s: number): Pt => ({ x: w.a.x + (w.b.x - w.a.x) * s / L, y: w.a.y + (w.b.y - w.a.y) * s / L });
  const pieces: Wall[] = [];
  if (s0 > NEAR_M) pieces.push({ ...w, id: freshWallId(state, w.placeId), b: pt(s0) });
  pieces.push({ ...w, id: freshWallId(state, w.placeId), a: pt(s0), b: pt(s1), kind, top });
  if (L - s1 > NEAR_M) pieces.push({ ...w, id: freshWallId(state, w.placeId), a: pt(s1) });
  state.walls.splice(state.walls.indexOf(w), 1, ...pieces);
  planChanged();
  for (const o of state.openings) if (o.wall === w.id) o.wall = pieces.find((x) => toSegment(o.at, x.a, x.b).d <= NEAR_M)?.id ?? pieces[0].id;
}

/** the wall standing at point p on a floor (p on its line), if any */
export function wallAt(state: GameState, p: Pt, floor: number): Wall | undefined {
  return state.walls.find((w) => Math.abs(w.floor - floor) <= 0.01 && toSegment(p, w.a, w.b).d <= NEAR_M);
}
/** the openings cut in wall w */
export const openingsIn = (state: GameState, w: Wall): Opening[] => state.openings.filter((o) => o.wall === w.id);
/** where along its wall an opening's gap runs, as shares of the wall's length from a */
export function gapOn(w: Wall, o: Opening): [number, number] {
  const L = dist(w.a, w.b) || 1, s = onWall(w, o.at).s;
  return [(s - o.widthM / 2) / L, (s + o.widthM / 2) / L];
}
export { GEO_EPS };
