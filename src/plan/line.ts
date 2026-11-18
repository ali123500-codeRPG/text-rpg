// PZ3 a, PZ4 a: a straight line through the floor plan. Sight needs a line from the viewer's eye to the target that no
// wall stops (a wall stops it where the line crosses below its top, except through an opening seen through within its
// span) and no roof or floor stops (except through stairs or an open hatch). Sound loses SOUND_LOSS_DB at each wall, shut
// opening and floor the line crosses.
import type { GameState, Opening, Pt, Roof, Wall } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { OP } from '../library/tableIds';
import type { SoundLossKey } from '../scales';
import { crossing, dist, inOutline, lerp } from './geom';
import { wallKind } from './walls';
import { planStamp } from './stamp';
export { planChanged } from './stamp';

/** a point in the air: x, y on the map and z metres above the ground outside */
export type P3 = { x: number; y: number; z: number };
/** where a line crosses a wall (through one of its openings, or not) or a roof (through a stair hole, or not) */
export type Crossing =
  | { kind: 'wall'; wall: Wall; t: number; at: Pt; z: number; opening?: Opening }
  | { kind: 'roof'; roof: Roof; t: number; at: Pt; hole?: Opening };

const CELL = 8; // metres a side of the walls' look-up grid
type Index = { stamp: number; n: number; first?: Wall; last?: Wall; cells: Map<string, Wall[]>; byWall: Map<string, Opening[]>; on: number; holes: Opening[]; box: { x0: number; y0: number; x1: number; y1: number } };
const indexes = new WeakMap<object, Index>();

/** the grid cells a segment passes through (both cells beside a corner it crosses exactly) */
function cellsOf(a: Pt, b: Pt): string[] {
  let cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
  const out = [`${cx}:${cy}`];
  const dx = b.x - a.x, dy = b.y - a.y, sx = Math.sign(dx), sy = Math.sign(dy);
  const tdx = dx ? Math.abs(CELL / dx) : Infinity, tdy = dy ? Math.abs(CELL / dy) : Infinity;
  let tx = dx ? ((sx > 0 ? (cx + 1) * CELL - a.x : a.x - cx * CELL) / Math.abs(dx)) : Infinity;
  let ty = dy ? ((sy > 0 ? (cy + 1) * CELL - a.y : a.y - cy * CELL) / Math.abs(dy)) : Infinity;
  // walk the cell edges the segment crosses in order, stopping once past its end (t > 1)
  while (Math.min(tx, ty) <= 1) {
    if (Math.abs(tx - ty) < 1e-12) { out.push(`${cx + sx}:${cy}`, `${cx}:${cy + sy}`); cx += sx; cy += sy; tx += tdx; ty += tdy; }
    else if (tx < ty) { cx += sx; tx += tdx; } else { cy += sy; ty += tdy; }
    out.push(`${cx}:${cy}`);
  }
  return out;
}
/** the part of segment a→b inside box (padded a cell), as [t0, t1], or null when it misses it */
function clip(a: Pt, b: Pt, box: Index['box']): [number, number] | null {
  let t0 = 0, t1 = 1;
  const pad = CELL, d = { x: b.x - a.x, y: b.y - a.y };
  for (const [p, q] of [[-d.x, a.x - (box.x0 - pad)], [d.x, box.x1 + pad - a.x], [-d.y, a.y - (box.y0 - pad)], [d.y, box.y1 + pad - a.y]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}
/** the walls' look-up grid and openings by wall, rebuilt when the plan changed */
function indexOf(state: GameState): Index {
  const walls = state.walls, openings = state.openings;
  let ix = indexes.get(walls);
  if (ix && ix.stamp === planStamp() && ix.n === walls.length && ix.first === walls[0] && ix.last === walls[walls.length - 1] && ix.on === openings.length) return ix;
  const cells = new Map<string, Wall[]>();
  for (const w of walls) for (const c of cellsOf(w.a, w.b)) { const l = cells.get(c); if (l) l.push(w); else cells.set(c, [w]); }
  const byWall = new Map<string, Opening[]>();
  for (const o of openings) if (o.wall) { const l = byWall.get(o.wall); if (l) l.push(o); else byWall.set(o.wall, [o]); }
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const w of walls) for (const p of [w.a, w.b]) { box.x0 = Math.min(box.x0, p.x); box.y0 = Math.min(box.y0, p.y); box.x1 = Math.max(box.x1, p.x); box.y1 = Math.max(box.y1, p.y); }
  ix = { box, stamp: planStamp(), n: walls.length, first: walls[0], last: walls[walls.length - 1], cells, byWall, on: openings.length, holes: openings.filter((o) => !!o.to && Math.abs(o.to.floor - o.floor) > 0.01 && o.kind === OP.stairs) };
  indexes.set(walls, ix);
  return ix;
}

/** the openings cut in a wall */
export const openingsOn = (state: GameState, w: Wall): Opening[] => indexOf(state).byWall.get(w.id) ?? [];

/** every wall and roof the straight line from A to B crosses, in order (its ends excluded: standing at a wall is not
 * crossing it) */
export function crossings(state: GameState, A: P3, B: P3): Crossing[] {
  const ix = indexOf(state), out: Crossing[] = [];
  const lo = Math.min(A.z, B.z), hi = Math.max(A.z, B.z);
  const seen = new Set<Wall>();
  const span = clip(A, B, ix.box); // only the stretch of the line where walls stand is walked through the grid
  if (span) for (const c of cellsOf(lerp(A, B, span[0]), lerp(A, B, span[1]))) for (const w of ix.cells.get(c) ?? []) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (w.top <= lo + 1e-9 || w.floor > hi + 1e-9) continue;
    const x = crossing(A, B, w.a, w.b);
    if (!x || x.t <= 1e-6 || x.t >= 1 - 1e-6) continue;
    const z = A.z + (B.z - A.z) * x.t;
    if (z < w.floor - 1e-9 || z >= w.top) continue;
    const at = lerp(A, B, x.t);
    const L = dist(w.a, w.b), s = x.u * L;
    const opening = (ix.byWall.get(w.id) ?? []).find((o) => {
      const so = (o.at.x - w.a.x) * (w.b.x - w.a.x) / (L || 1) + (o.at.y - w.a.y) * (w.b.y - w.a.y) / (L || 1);
      const sill = o.floor + (o.sillM ?? 0);
      return Math.abs(s - so) <= o.widthM / 2 + 1e-6 && z >= sill - 1e-9 && z <= sill + o.heightM + 1e-9;
    });
    out.push({ kind: 'wall', wall: w, t: x.t, at, z, ...(opening ? { opening } : {}) });
  }
  if (hi - lo > 1e-6) for (const r of state.roofs) {
    if (r.h <= lo + 1e-6 || r.h >= hi - 1e-6) continue;
    const t = (r.h - A.z) / (B.z - A.z), at = lerp(A, B, t);
    if (!inOutline(at, r.outline, 0)) continue;
    const hole = ix.holes.find((o) => Math.min(o.floor, o.to!.floor) < r.h && Math.max(o.floor, o.to!.floor) >= r.h - 1e-6 && dist(o.at, at) <= Math.max(o.widthM, 1) / 2 + 0.5);
    out.push({ kind: 'roof', roof: r, t, at, ...(hole ? { hole } : {}) });
  }
  return out.sort((p, q) => p.t - q.t);
}

/** BG-70, PC4: an opening shows the far side now: its barrier stands open, is broken, or is seen through (bars, a slit);
 * with no barrier, by its own kind (a gap or window does, a plain doorway does not) */
export function seesNow(state: GameState, o: Opening): boolean {
  const b = o.barrier ? state.barriers?.[o.barrier] : undefined;
  if (b) return !!b.open || b.state === 'destroyed' || !!getLibrary().barrierKinds?.[b.kind]?.seeThrough;
  return o.seeThrough;
}
/** PZ3 a: nothing on the line from A to B stops sight */
export function lineClear(state: GameState, A: P3, B: P3): boolean {
  for (const c of crossings(state, A, B)) {
    if (c.kind === 'roof') { if (!c.hole || !holeOpen(state, c.hole)) return false; continue; }
    if (c.opening ? !seesNow(state, c.opening) && !wallKind(c.wall.kind)?.see : !wallKind(c.wall.kind)?.see) return false;
  }
  return true;
}
/** a stair hole is open: no hatch on it, or its hatch stands open */
const holeOpen = (state: GameState, o: Opening): boolean => !o.barrier || seesNow(state, o);

const lossDb = (k: SoundLossKey | undefined): number => CONFIG.SOUND_LOSS_DB[k ?? 'open'];
/** HB4, PZ4: what a sound loses through an opening: its barrier by kind while shut (a door, a gate, a hatch; a grate's bars
 * nothing); a window with no shutters a pane's; a plain doorway a shut door's; else nothing */
export function openingLoss(state: GameState, o: Opening): number {
  const b = o.barrier ? state.barriers?.[o.barrier] : undefined;
  if (b) return b.open || b.state === 'destroyed' ? 0 : lossDb(getLibrary().barrierKinds?.[b.kind]?.sound);
  if (o.kind === OP.window) return lossDb('window');
  return lossDb(o.seeThrough ? 'open' : 'door');
}
/** PZ4 a: the decibels a sound loses on the straight line from A to B: each wall by its kind (a low wall or fence
 * nothing), each opening by what stands in it, each floor or roof as a wall unless through an open stair hole */
export function lineLoss(state: GameState, A: P3, B: P3): number {
  let db = 0;
  for (const c of crossings(state, A, B)) {
    if (c.kind === 'roof') db += c.hole && holeOpen(state, c.hole) ? 0 : lossDb('wall');
    else db += c.opening ? openingLoss(state, c.opening) : lossDb(wallKind(c.wall.kind)?.sound ?? 'wall');
  }
  return db;
}
