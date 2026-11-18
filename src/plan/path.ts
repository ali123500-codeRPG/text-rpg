// PZ8 a: walking paths. A walk goes straight where nothing is in the way, else round walls through their corners and
// openings: the shortest path over a visibility graph of each floor's convex wall corners (CORNER_CLEAR_M off them) and
// openings, with stairs, ladders, hatches and passages joining their two ends. It never goes through a wall a walker cannot
// walk across (a wall, a low wall or fence, glazing), a window (only jumped down, SD7), a frontier, a way shut to the
// walker that it knows is shut (BG-69, FR5), or an opening too small for its body (SZ7).
import type { Actor, GameState, Opening, Pt, Pt3, Wall } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary } from '../library';
import { dist, NEAR_M } from './geom';
import { crossings } from './line';
import { wallKind } from './walls';
import { planStamp } from './stamp';
import { zoneAt } from './where';
import { barrierOn, linkPassage } from '../engine/barriers';
import { knowsShut } from '../engine/relations';

/** who walks: the walker (whose known-shut ways are left out) and the body that must fit the openings */
export type Walker = { walker?: Actor; body?: Actor };
/** a walking path: its points from start to end (each on its floor), its metres (climbs added) and the openings it goes
 * through, in order */
export type WalkPath = { pts: Pt3[]; metres: number; through: Opening[] };

const KNEE = 0.3; // a walk's line is tested this high above its floor: a doorway's sill is 0, a window's is not
const key = (f: number) => Math.round(f * 100) / 100;

type Node = { p: Pt; floor: number; o?: Opening; end?: 'at' | 'to' };
type Graph = { stamp: number; walls: object; nodes: Node[]; byFloor: Map<number, number[]>; edges: Map<number, { j: number; m: number; through: Opening[] }[]> };
const graphs = new WeakMap<object, Graph>();

/** SZ7: `a`'s body goes through the opening: the narrower of its length and width fits the width (it turns sideways)
 * and its height, ducked to DUCK_SHARE, fits the height; through a hatch upright, its longer side fits the length */
export function fitsOpening(state: GameState, a: Actor, o: Opening): boolean {
  const b = barrierOn(state, o), k = b ? getLibrary().barrierKinds?.[b.kind] : undefined;
  if (!o.widthM || !o.heightM) return true;
  const s = actorBody(state, a).size, narrow = Math.min(s.lengthM, s.widthM), long = Math.max(s.lengthM, s.widthM);
  const vertical = !!k?.vertical;
  return narrow <= o.widthM + 1e-9 && (vertical ? long : s.heightM * CONFIG.DUCK_SHARE) <= o.heightM + 1e-9;
}
/** the title an opening is gone through from, for someone at point p on its floor */
function fromSide(state: GameState, o: Opening, p: Pt, floor: number): string {
  const z = zoneAt(state, p, floor);
  return z && z.id === o.joins[1] ? o.joins[1] : o.joins[0];
}
/** a walker gets through opening o going from point p: a walked kind, not a frontier, its body fits, and its barrier is
 * not one it knows is shut to it */
function passes(state: GameState, o: Opening, w: Walker, p: Pt, floor: number): boolean {
  if (o.frontier || !getLibrary().openingKinds?.[o.kind]?.walk) return false;
  if (w.body && !fitsOpening(state, w.body, o)) return false;
  const b = barrierOn(state, o);
  if (w.walker && b) {
    const from = fromSide(state, o, p, floor);
    if (linkPassage(state, o, w.walker, from) === 'shut' && knowsShut(state, b, w.walker, from)) return false;
  }
  return true;
}

/** the straight walk from p to q on a floor: null when a wall stops it, else the openings it goes through (any walked
 * opening counts here; who may pass them is checked per walker) */
function segment(state: GameState, p: Pt, q: Pt, floor: number): Opening[] | null {
  const through: Opening[] = [];
  for (const c of crossings(state, { ...p, z: floor + KNEE }, { ...q, z: floor + KNEE })) {
    if (c.kind !== 'wall') continue;
    if (wallKind(c.wall.kind)?.walk) continue;
    if (!c.opening || c.opening.frontier || !getLibrary().openingKinds?.[c.opening.kind]?.walk) return null;
    through.push(c.opening);
  }
  return through;
}

/** the corners a walk may bend round: off each wall end, into every gap between walls there wider than a half turn (the
 * outside of a corner, either side of a free end) */
function cornersOf(walls: Wall[]): Node[] {
  const out: Node[] = [];
  const ends = new Map<string, { p: Pt; floor: number; dirs: number[] }>();
  for (const w of walls) {
    if (wallKind(w.kind)?.walk) continue;
    for (const [e, o] of [[w.a, w.b], [w.b, w.a]] as const) {
      const k = `${key(w.floor)}:${Math.round(e.x * 20)}:${Math.round(e.y * 20)}`;
      const ang = Math.atan2(o.y - e.y, o.x - e.x);
      const x = ends.get(k);
      if (x) x.dirs.push(ang); else ends.set(k, { p: e, floor: w.floor, dirs: [ang] });
    }
  }
  const c = CONFIG.CORNER_CLEAR_M;
  for (const { p, floor, dirs } of ends.values()) {
    const ds = [...dirs].sort((a, b) => a - b);
    for (let i = 0; i < ds.length; i++) {
      const a = ds[i], b = i + 1 < ds.length ? ds[i + 1] : ds[0] + 2 * Math.PI;
      const gap = b - a;
      if (gap <= Math.PI + 1e-6) continue;
      const mid = a + gap / 2, k = c / Math.max(0.3, Math.sin(gap / 2)); // as far off each wall's line as CORNER_CLEAR_M
      if (ds.length === 1) { // a free end: either side round it
        for (const s of [-1, 1]) { const t = a + Math.PI + s * Math.PI / 4; out.push({ p: { x: p.x + Math.cos(t) * c * Math.SQRT2, y: p.y + Math.sin(t) * c * Math.SQRT2 }, floor }); }
      } else out.push({ p: { x: p.x + Math.cos(mid) * k, y: p.y + Math.sin(mid) * k }, floor });
    }
  }
  return out;
}

/** the plan's visibility graph's nodes (corners and openings, by floor), rebuilt when the plan changed; edges come lazily */
function graphOf(state: GameState): Graph {
  const g0 = graphs.get(state.walls);
  if (g0 && g0.stamp === planStamp() && g0.walls === state.walls) return g0;
  const nodes: Node[] = [...cornersOf(state.walls)];
  for (const o of state.openings) {
    if (o.frontier || !Number.isFinite(o.at.x)) continue;
    nodes.push({ p: o.at, floor: o.floor, o, end: 'at' });
    if (o.to) nodes.push({ p: o.to, floor: o.to.floor, o, end: 'to' });
  }
  const byFloor = new Map<number, number[]>();
  nodes.forEach((n, i) => { const k = key(n.floor); const l = byFloor.get(k); if (l) l.push(i); else byFloor.set(k, [i]); });
  const g: Graph = { stamp: planStamp(), walls: state.walls, nodes, byFloor, edges: new Map() };
  graphs.set(state.walls, g);
  return g;
}
/** node i's edges: every node on its floor in plain sight of a walk, and the far end of its opening's stairs or passage */
function edgesOf(state: GameState, g: Graph, i: number) {
  let e = g.edges.get(i);
  if (e) return e;
  e = [];
  const n = g.nodes[i];
  for (const j of g.byFloor.get(key(n.floor)) ?? []) {
    if (j === i) continue;
    const q = g.nodes[j], m = dist(n.p, q.p);
    if (m <= NEAR_M && !(n.o && n.o === q.o)) { e.push({ j, m, through: [] }); continue; }
    const through = segment(state, n.p, q.p, n.floor);
    if (through) e.push({ j, m, through });
  }
  if (n.o?.to) { // stairs, a ladder, a hatch or a passage: to its other end, the climb added
    const j = g.nodes.findIndex((x) => x.o === n.o && x.end !== n.end);
    if (j >= 0) e.push({ j, m: dist(n.o.at, n.o.to) + Math.abs(n.o.to.floor - n.o.floor), through: [n.o] });
  }
  g.edges.set(i, e);
  return e;
}

/** PZ8 a: the shortest walk from A to B (each a point on its floor) for walker `w` (none: any walked opening passes), or
 * null with no way */
export function walkPath(state: GameState, A: Pt3, B: Pt3, w: Walker = {}): WalkPath | null {
  const ok = (through: Opening[], p: Pt, floor: number) => through.every((o) => passes(state, o, w, p, floor));
  if (key(A.floor) === key(B.floor)) {
    const t = segment(state, A, B, A.floor);
    if (t && ok(t, A, A.floor)) return { pts: [A, B], metres: dist(A, B), through: t };
  }
  const g = graphOf(state);
  const S = g.nodes.length, T = S + 1;
  const pos = (i: number): Node => (i === S ? { p: A, floor: A.floor } : i === T ? { p: B, floor: B.floor } : g.nodes[i]);
  // the start's and goal's edges, to the nodes on their floors in plain sight
  const toGoal = new Map<number, { m: number; through: Opening[] }>();
  for (const j of g.byFloor.get(key(B.floor)) ?? []) {
    const through = segment(state, g.nodes[j].p, B, B.floor);
    if (through) toGoal.set(j, { m: dist(g.nodes[j].p, B), through });
  }
  const startEdges: { j: number; m: number; through: Opening[] }[] = [];
  for (const j of g.byFloor.get(key(A.floor)) ?? []) {
    const through = segment(state, A, g.nodes[j].p, A.floor);
    if (through) startEdges.push({ j, m: dist(A, g.nodes[j].p), through });
  }
  const h = (i: number) => dist(pos(i).p, B) + Math.abs(pos(i).floor - B.floor);
  const best = new Map<number, { cost: number; prev?: number; through: Opening[] }>([[S, { cost: 0, through: [] }]]);
  const open = new Set([S]), done = new Set<number>();
  while (open.size) {
    let cur = -1, cf = Infinity;
    for (const i of open) { const f = best.get(i)!.cost + h(i); if (f < cf) { cf = f; cur = i; } }
    open.delete(cur);
    if (cur === T) break;
    done.add(cur);
    const here = pos(cur), c0 = best.get(cur)!.cost;
    const out = cur === S ? startEdges : edgesOf(state, g, cur);
    const relax = (j: number, m: number, through: Opening[]) => {
      if (done.has(j) || !ok(through, here.p, here.floor)) return;
      // an opening node is gone through, not just reached: its own way must let the walker by
      if (j < S && g.nodes[j].o && !g.nodes[j].o!.to && !passes(state, g.nodes[j].o!, w, here.p, here.floor)) return;
      const c = c0 + m, o = j < S ? g.nodes[j].o : undefined;
      // a walk that stops on an opening's own point goes through it (the segments to it end there, so never cross it)
      if (c < (best.get(j)?.cost ?? Infinity)) { best.set(j, { cost: c, prev: cur, through: o ? [...through, o] : through }); open.add(j); }
    };
    for (const e of out) relax(e.j, e.m, e.through);
    if (cur !== S) { const tg = toGoal.get(cur); if (tg) relax(T, tg.m, tg.through); }
  }
  const end = best.get(T);
  if (!end) return null;
  const pts: Pt3[] = [], through: Opening[] = [];
  for (let i: number | undefined = T; i !== undefined; i = best.get(i)!.prev) {
    const n = pos(i);
    pts.unshift({ x: n.p.x, y: n.p.y, floor: n.floor });
    through.unshift(...best.get(i)!.through);
  }
  return { pts, metres: end.cost, through: [...new Set(through)] };
}
