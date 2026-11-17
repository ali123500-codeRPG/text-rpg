// ZP1–ZP4 (step 2): everyone on stage stands at a point in metres on the map, in the frame of the zones' rectangles
// (Zone.rect). Code places people inside their zone, keeps them there, and measures distance between two people as a
// straight line when there is sight between their zones (the same zone, or zones joined by sight links), else as the
// walking path through the doorways. ZR8: every zone has a rectangle (the game builds one for each, and so does the test
// village), so nothing is measured in zone links; a zone without one is a world-building bug and throws.
// SZ4, SZ5: a person takes up room: a capsule on the floor (its size from actorBody), turned the way it faces, as tall as
// it stands. Every distance between two people is the gap between their bodies; to a spot, from the body's edge. The
// first one measured from turns toward the other (as it does to strike, look or speak); the other keeps its facing.
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { compassOf, doorway, edgeToward } from '../scenario/geometry';
import { furnitureById, furniturePos } from './furniture';
import { heightOf } from '../scenario/heights';
import { actorById, allActors, nameFor, shortestPath, wayPath, zoneById } from './relations';
import { theName, theOf } from '../words';
import { barrierOn, gripPasses, passage, type Passage } from './barriers';
import { gripReachM } from '../ruleset/body';
import { actorBody } from '../library';
import { sightFactor } from '../library/bodySize';
import { followGap } from './follow';
import type { Actor, Barrier, GameState, MoveSpot, Zone } from '../types';

export type Pos = { x: number; y: number };
/** someone or something that stands somewhere: a zone, and a point in it once the zone has a rectangle */
export type Located = { zone: string; pos?: Pos };

/** metres closer than this count as the same spot (a step's rounding) */
export const M_EPS = 0.01;
const EPS = M_EPS;
/** BG-120: `d` metres is within `reach`: the one comparison for every reach, so someone who walked up to stop exactly
 * at a reach (a step-up, closing in) is never left a hair outside it by rounding (BG-267: CONFIG.REACH_MARGIN_M past it) */
export const withinM = (d: number, reach: number): boolean => d <= reach + CONFIG.REACH_MARGIN_M;
/** IC12 a: a decision (close in first? is the attack ranged from here?) uses the exact reach; withinM's margin only
 * soaks up a step's rounding when the blow itself lands */
export const reachesM = (d: number, reach: number): boolean => d <= reach;
/** IC12 a: closing in for a blow aims CONFIG.REACH_MARGIN_M inside the reach, so the walk always stops within it */
export const closeInM = (reach: number): number => Math.max(0, reach - CONFIG.REACH_MARGIN_M);
const centre = (z: Zone): Pos | undefined => (z.rect ? { x: z.rect.x, y: z.rect.y } : undefined);
/** p lies in zone z's rectangle (false when it has none), give or take M_EPS */
export const inside = (z: Zone, p: Pos) => !!z.rect && Math.abs(p.x - z.rect.x) <= z.rect.w / 2 + EPS && Math.abs(p.y - z.rect.y) <= z.rect.d / 2 + EPS;
const flat = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (A: Pos, B: Pos): [number, number] | undefined => { const d = flat(A, B); return d > EPS ? [(B.x - A.x) / d, (B.y - A.y) / d] : undefined; };

/** SZ4: a body on the floor: a capsule whose spine runs `half` metres either way of `p` along `ax`, `r` round it, `h` tall.
 * A spot (no body) is a point: half, r and h 0. */
export type Shape = { p: Pos; ax: [number, number]; half: number; r: number; h: number };
const isActor = (x: Located): x is Actor => 'core' in x;
/** SZ4: the shape of what stands at `x` (or at `at`, facing `facing`): an actor's body by its size (actorBody), its spine
 * along its longer side, the length along the way it faces (north before it ever walked); anything else a point */
export function shapeOf(state: GameState, x: Located, at: Pos, facing?: [number, number]): Shape {
  if (!isActor(x)) return { p: at, ax: [1, 0], half: 0, r: 0, h: 0 };
  const { lengthM: l, widthM: w, heightM: h } = actorBody(state, x).size, f = facing ?? x.facing ?? [0, 1];
  return { p: at, ax: l >= w ? f : [-f[1], f[0]], half: Math.abs(l - w) / 2, r: Math.min(l, w) / 2, h };
}
const ends = (s: Shape): [Pos, Pos] => [{ x: s.p.x - s.ax[0] * s.half, y: s.p.y - s.ax[1] * s.half }, { x: s.p.x + s.ax[0] * s.half, y: s.p.y + s.ax[1] * s.half }];
/** metres from point p to the segment a–b */
function toSeg(p: Pos, a: Pos, b: Pos): number {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const cross = (o: Pos, a: Pos, b: Pos) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** metres between two segments (0 where they cross) */
function segSeg([a0, a1]: [Pos, Pos], [b0, b1]: [Pos, Pos]): number {
  if (cross(a0, a1, b0) * cross(a0, a1, b1) < 0 && cross(b0, b1, a0) * cross(b0, b1, a1) < 0) return 0;
  return Math.min(toSeg(a0, b0, b1), toSeg(a1, b0, b1), toSeg(b0, a0, a1), toSeg(b1, a0, a1));
}
/** SZ5: the gap on the floor between two shapes (0 when they touch or overlap) */
export const shapeGap = (a: Shape, b: Shape): number => Math.max(0, segSeg(ends(a), ends(b)) - a.r - b.r);
/** SZ5: metres from a point to a shape's edge */
const pointGap = (p: Pos, s: Shape): number => Math.max(0, toSeg(p, ...ends(s)) - s.r);
/** SZ5: the gap on the floor between what stands at a and b, wherever their zones are (spots, people) */
export function floorGap(state: GameState, a: Located, b: Located): number {
  const pa = pointOf(state, a), pb = pointOf(state, b);
  return shapeGap(shapeOf(state, a, pa, unit(pa, pb)), shapeOf(state, b, pb));
}

/** where it stands: its own point while that lies in its zone, else the zone's centre; no point in a zone without a rectangle */
export function spotOf(state: GameState, a: Located): Located {
  const z = zoneById(state, a.zone);
  if (!z?.rect) return { zone: a.zone };
  return { zone: a.zone, pos: a.pos && inside(z, a.pos) ? a.pos : centre(z) };
}

/** ZR8: the point where it stands (spotOf); a zone without a rectangle has none, and that is a bug, never a zone link */
function pointOf(state: GameState, a: Located): Pos {
  const p = spotOf(state, a).pos;
  if (!p) throw noRect({ id: a.zone });
  return p;
}

/** ZP1: gives everyone on stage whose point is missing or outside its zone a free spot in it: the zone's centre, else the
 * nearest point on a half-PLACE_SPACING_M grid around it whose body keeps PLACE_SPACING_M from everyone already standing
 * there (SZ6: body to body) */
export function placeAll(state: GameState): void {
  const gap = CONFIG.PLACE_SPACING_M;
  const people = allActors(state);
  for (const a of people) {
    const z = zoneById(state, a.zone);
    if (!z?.rect) { delete a.pos; continue; }
    if (a.pos && inside(z, a.pos)) continue;
    const taken = people.filter((o) => o !== a && o.zone === a.zone && o.pos && inside(z, o.pos)).map((o) => shapeOf(state, o, o.pos!));
    const c = anchor(state, z);
    let spot = c;
    const step = gap / 2; // SZ6: a finer grid than the spacing, so bodies of any width find the nearest free spot
    for (let r = 0; r <= 100; r++) {
      let best: Pos | undefined; // the nearest free point of this ring
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const p = { x: c.x + i * step, y: c.y + j * step };
        if ((!best || flat(p, c) < flat(best, c)) && inside(z, p) && taken.every((t) => shapeGap(shapeOf(state, a, p), t) >= gap - EPS)) best = p; // SZ6: bodies, edge to edge
      }
      if (best) { spot = best; break; }
    }
    a.pos = { ...spot };
  }
}

/** where placeAll starts looking in a zone: an encounter's point on the road (TV4); on a road, beside the player (the
 * companions who travelled with it); else the zone's centre */
function anchor(state: GameState, z: Zone): Pos {
  const e = state.stage.encounter, p = state.player;
  if (e && e.zone === z.id && inside(z, e.at)) return e.at;
  if (z.kind && getLibrary().zoneKinds?.[z.kind]?.road && p.zone === z.id && p.pos && inside(z, p.pos)) return p.pos;
  return centre(z)!;
}

const clampTo = (r: NonNullable<Zone['rect']>, p: Pos): Pos => ({ x: Math.max(r.x - r.w / 2, Math.min(r.x + r.w / 2, p.x)), y: Math.max(r.y - r.d / 2, Math.min(r.y + r.d / 2, p.y)) });
/** where a walk leaves one zone (`out`) and enters the next (`at`): their doorway; for linked zones that don't touch, the
 * point of a's edge nearest b and the point of b's edge nearest that (BG-7: the gap between them is not walked, as a link
 * means the zones adjoin, so the walk never stands outside both) */
function crossing(a: Zone, b: Zone): { out: Pos; at: Pos } {
  const d = doorway(a, b);
  if (d) return { out: d, at: d };
  const out = clampTo(a.rect!, { x: b.rect!.x, y: b.rect!.y });
  return { out, at: clampTo(b.rect!, out) };
}

/** the walking route from A to B: the zones after A, each with the points where the walk leaves the zone before and enters
 * it (none without rectangles) */
function route(state: GameState, A: Located, B: Located, walker?: Actor): Leg[] | null {
  const path = walker ? wayPath(state, A.zone, B.zone, walker) : shortestPath(state, A.zone, B.zone);
  return path ? legs(state, A.zone, path) : null;
}
type Leg = { zone: Zone; at?: Pos; out?: Pos };
/** a path's zones (the ids after `from`), each with where the walk leaves the zone before and enters it */
function legs(state: GameState, from: string, path: string[]): Leg[] {
  let prev = zoneById(state, from)!;
  return path.map((id) => {
    const z = zoneById(state, id)!;
    const c = prev.rect && z.rect ? crossing(prev, z) : undefined;
    prev = z;
    return { zone: z, ...(c ? { at: c.at, out: c.out } : {}) };
  });
}
/** ZR8: a zone without a rectangle is a world-building bug */
const noRect = (z: { id: string }) => new Error(`zone ${z.id} has no rectangle: distances are metres between points`);

/** metres between two people with sight between their zones (the same zone, or a path of sight links): the straight
 * line; Infinity without sight. What an attack reaches across (a blow or a shot never goes round a wall). SZ5: the gap
 * between their bodies, each standing from its floor to its height (bodies that overlap in height have no height gap). */
export function sightDistM(state: GameState, a: Located, b: Located): number {
  const pa = pointOf(state, a), pb = pointOf(state, b), A = shapeOf(state, a, pa, unit(pa, pb)), B = shapeOf(state, b, pb);
  if (a.zone === b.zone) return shapeGap(A, B);
  if (!shortestPath(state, a.zone, b.zone, true)) return Infinity;
  const ha = heightOf(zoneById(state, a.zone)), hb = heightOf(zoneById(state, b.zone));
  return Math.hypot(shapeGap(A, B), ha <= hb ? Math.max(0, hb - ha - A.h) : Math.max(0, ha - hb - B.h));
}

/** SZ11: how much farther `b` is seen from `a` than a person would be: its body's sightFactor at the look-down angle (a
 * zone above looking down on it); 1 for a spot. Sight ranges and the range penalty read distances ÷ this. */
export function seenSizeFactor(state: GameState, a: Located, b: Located): number {
  if (!('core' in b)) return 1;
  const drop = Math.max(0, heightOf(zoneById(state, a.zone)) - heightOf(zoneById(state, b.zone)));
  return sightFactor(actorBody(state, b as Actor).size, drop > 0 ? Math.atan2(drop, Math.max(floorGap(state, a, b), EPS)) : 0);
}

/** step 2 PR 2: how far away something is for sight, in metres: sightDistM ÷ how big it looks (SZ11: a horse is seen as
 * far again as a person at nearly twice the metres), never under NEAREST_M; null without sight */
export function seeingM(state: GameState, a: Located, b: Located): number | null {
  const d = sightDistM(state, a, b);
  return d === Infinity ? null : Math.max(d / seenSizeFactor(state, a, b), CONFIG.NEAREST_M);
}

/** ZP4: metres between two people (or a person and a spot): a straight line with sight between their zones, else the
 * walking path through the doorways; Infinity with no way between them */
export function distM(state: GameState, a: Located, b: Located): number {
  const seen = sightDistM(state, a, b);
  if (seen < Infinity) return seen;
  const path = shortestPath(state, a.zone, b.zone);
  return path ? pathM(state, a, b, path) : Infinity;
}

/** distM, or null where a zone on the way has no rectangle (an old map's zone): for checks that must not stop the turn */
export function distOrNull(state: GameState, a: Located, b: Located): number | null {
  try { return distM(state, a, b); } catch { return null; }
}

/** metres from A to B along a given route (the zone ids after A's, ending in B's): through the doorways, or where zones
 * touch the middle of what they share. SZ5: from A's body's edge to B's (a spot is a point) */
export function pathM(state: GameState, a: Located, b: Located, path: string[]): number {
  const pa = pointOf(state, a), pb = pointOf(state, b);
  if (!path.length) return shapeGap(shapeOf(state, a, pa, unit(pa, pb)), shapeOf(state, b, pb));
  const r = legs(state, a.zone, path);
  const gap = r.find((s) => !s.at);
  if (gap) throw noRect(gap.zone);
  const A = shapeOf(state, a, pa, unit(pa, r[0].out!)), B = shapeOf(state, b, pb);
  let m = pointGap(r[0].out!, A) + Math.abs(heightOf(r[0].zone) - heightOf(zoneById(state, a.zone))), cur = r[0].at!, h = heightOf(r[0].zone);
  for (const s of r.slice(1)) { m += flat(cur, s.out!) + Math.abs(heightOf(s.zone) - h); cur = s.at!; h = heightOf(s.zone); }
  return m + pointGap(cur, B);
}

/** AD16: the walk from A to B as walkLeg walks it (the walker's way round shut ways it knows, wayPath; else the plain path):
 * the zones after A's, its points from A's to B's through the doorways, and its metres (pathM); null with no way */
export function walkRoute(state: GameState, a: Located, b: Located, walker?: Actor): { path: string[]; pts: Pos[]; metres: number } | null {
  const path = a.zone === b.zone ? [] : walker ? wayPath(state, a.zone, b.zone, walker) : shortestPath(state, a.zone, b.zone);
  if (!path) return null;
  const pts = [pointOf(state, a)];
  for (const s of legs(state, a.zone, path)) {
    if (!s.at) throw noRect(s.zone);
    pts.push(s.out!);
    if (flat(s.out!, s.at) > EPS) pts.push(s.at);
  }
  pts.push(pointOf(state, b));
  return { path, pts, metres: pathM(state, { zone: a.zone, pos: pts[0] }, { zone: b.zone, pos: pts.at(-1) }, path) }; // the walker's own path
}

/** a step of a walk to `to`: the walker now faces the way it walked (BG-18: \"the slime on the left\") */
function step(a: { pos?: Pos; facing?: [number, number] }, to: Pos): void {
  const from = a.pos, d = from ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  if (from && d > EPS) a.facing = [(to.x - from.x) / d, (to.y - from.y) / d];
  a.pos = { ...to };
}

/** SZ4: the actor turns to face what it strikes or speaks to (turning never collides) */
export function faceToward(a: Actor, at: Located): void {
  const d = a.pos && at.pos && at.zone === a.zone ? unit(a.pos, at.pos) : undefined;
  if (d) a.facing = d;
}

/** BG-18: where someone stands as the viewer sees it, by the way the viewer faces (the way it last walked): ahead, left,
 * right or behind, each a quarter turn wide; null when either has no point or the viewer has not walked */
export function sideFrom(viewer: { pos?: Pos; facing?: [number, number] }, at: Pos | undefined): 'ahead' | 'left' | 'right' | 'behind' | null {
  const f = viewer.facing, p = viewer.pos;
  if (!f || !p || !at) return null;
  const dx = at.x - p.x, dy = at.y - p.y;
  if (Math.hypot(dx, dy) <= EPS) return null;
  const ahead = dx * f[0] + dy * f[1], left = f[0] * dy - f[1] * dx; // north is +y, so a left turn is anticlockwise
  return Math.abs(ahead) >= Math.abs(left) ? (ahead >= 0 ? 'ahead' : 'behind') : left > 0 ? 'left' : 'right';
}

/** BF35/BF71: everyone else in the walker's zone whose spot a walk's end keeps PLACE_GAP_M from: all of them (none is let
 * off for standing near the start), but never the one it closes in on (`toward`), whom it stops at reach from */
const othersFor = (state: GameState, walker: Actor, toward?: string) =>
  allActors(state).filter((x) => x !== walker && x.id !== toward && x.zone === walker.zone && !!x.pos);
/** SZ6: the walker's body at p (facing `dir`) keeps PLACE_GAP_M from everyone else's */
const free = (state: GameState, walker: Actor, others: Actor[], p: Pos, dir?: [number, number]) => {
  const me = shapeOf(state, walker, p, dir);
  return !others.some((x) => shapeGap(me, shapeOf(state, x, x.pos!)) < CONFIG.PLACE_GAP_M - EPS);
};
/** the largest t in [lo, hi] where ok(t) holds, given ok holds up to some t and not past it */
function lastTrue(ok: (t: number) => boolean, lo: number, hi: number): number {
  if (ok(hi)) return hi;
  for (let i = 0; i < 40 && hi - lo > EPS / 10; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  return lo;
}

/** BF35: how far along the line from `A` toward `B` (d metres) the walker may go, at most `go`, so that where it stops keeps
 * PLACE_GAP_M from everyone else in its zone */
function roomAt(state: GameState, walker: Actor, A: Pos, B: Pos, go: number, d: number, toward?: string): number {
  const others = othersFor(state, walker, toward), dir = unit(A, B);
  const at = (t: number): Pos => ({ x: A.x + (B.x - A.x) * t / d, y: A.y + (B.y - A.y) * t / d });
  let t = go;
  for (let i = 0; i < 400 && t > EPS && !free(state, walker, others, at(t), dir); i++) t = Math.max(0, t - CONFIG.PLACE_GAP_M / 10);
  return t;
}

/** BF71: the free spots, nearest to `from` first, round `target` (standing at B) where the walker's body, facing it, is `r`
 * metres from its body (SZ5) inside the walker's zone, keeping PLACE_GAP_M from everyone but `toward` (RING_STEPS
 * directions round it) */
function ringSpots(state: GameState, walker: Actor, target: Located, B: Pos, r: number, from: Pos, toward?: string): Pos[] {
  const z = zoneById(state, walker.zone);
  if (!z?.rect || r <= EPS) return [];
  const others = othersFor(state, walker, toward), G = shapeOf(state, target, B);
  const me = shapeOf(state, walker, B), far = r + 2 * (me.half + me.r + G.half + G.r) + 1;
  const out: Pos[] = [];
  for (let i = 0; i < CONFIG.RING_STEPS; i++) {
    const t = (2 * Math.PI * i) / CONFIG.RING_STEPS, c = Math.cos(t), sn = Math.sin(t);
    const at = (k: number): Pos => ({ x: B.x + k * c, y: B.y + k * sn }), dir: [number, number] = [-c, -sn];
    const k = lastTrue((m) => shapeGap(shapeOf(state, walker, at(far - m), dir), G) >= r, 0, far); // walking in from far out
    const p = at(far - k);
    if (inside(z, p) && free(state, walker, others, p, dir)) out.push(p);
  }
  return out.sort((a, b) => flat(a, from) - flat(b, from));
}

/** BF71: there is a free spot within `r` metres of `target` for `walker` to stand on (where it stands now counts): false when
 * the target is hemmed in on every side */
export function roomAround(state: GameState, walker: Actor, target: Actor, r: number): boolean {
  const A = pointOf(state, walker), B = pointOf(state, target);
  if (walker.zone !== target.zone || !A || !B) return true;
  if (floorGap(state, walker, target) <= r + EPS) return true;
  return ringSpots(state, walker, target, B, Math.max(0, r - EPS), A, target.id).length > 0;
}
/** ZP2: one leg of a walk toward `goal`: to the doorway of the next zone on the way (entering it), or, inside the goal's
 * zone, straight at the goal's point, stopping `stopShort` metres before it. A goal with no point is the zone itself: the
 * walk ends ENTER_M past its doorway. At most `metres` are walked. Returns the metres walked (0: nothing left to walk), or
 * null when there is no way. */
export function walkLeg(state: GameState, a: Located & { placeId?: string }, goal: Located, metres: number, stopShort = 0, walker?: Actor, halt = false, toward?: string): number | null {
  const A = { zone: a.zone, pos: pointOf(state, a) };
  if (A.zone === goal.zone) {
    if (!goal.pos) return 0;
    const B = pointOf(state, goal);
    const d = flat(A.pos, B);
    // SZ5: the walk ends where the walker's body, facing the way it walks, is stopShort from the goal's body (a spot: its point)
    const dir = unit(A.pos, B), G = shapeOf(state, goal, B);
    const end = d <= EPS ? 0 : lastTrue((t) => shapeGap(shapeOf(state, a, { x: A.pos.x + (B.x - A.pos.x) * t / d, y: A.pos.y + (B.y - A.pos.y) * t / d }, dir), G) >= stopShort, 0, d);
    let go = Math.min(metres, end);
    // BF35: a walk never ends on someone: at its end it stops PLACE_GAP_M short of anyone standing there
    if (walker && go >= end - EPS) {
      const room = roomAt(state, walker, A.pos, B, go, d, toward);
      // BF71: closing in on someone whose straight-line spot is taken, it steps round to the nearest free spot at that reach
      // its walk can get to; with none in its walk, it goes as far as the line lets it
      if (toward && room < go - EPS) {
        const p = ringSpots(state, walker, goal, B, stopShort, A.pos, toward).find((x) => flat(A.pos, x) <= metres + EPS);
        if (p) { const m = flat(A.pos, p); if (m <= EPS) return 0; step(a, p); return m; }
      }
      go = room;
    }
    if (go <= EPS) return 0;
    step(a, { x: A.pos.x + (B.x - A.pos.x) * go / d, y: A.pos.y + (B.y - A.pos.y) * go / d });
    return go;
  }
  const r = route(state, A, goal, walker);
  if (!r?.length) return null;
  const next = r[0];
  if (!next.at) throw noRect(next.zone);
  const enter = (at: Pos) => {
    a.zone = next.zone.id;
    a.placeId = next.zone.placeId;
    step(a, at);
  };
  const from = zoneById(state, A.zone);
  const out = next.out ?? next.at;
  const leg = flat(A.pos, out) + Math.abs(heightOf(next.zone) - heightOf(from));
  if (leg > metres + EPS) {
    if (metres <= EPS) return 0;
    const k = metres / leg;
    step(a, { x: A.pos.x + (out.x - A.pos.x) * k, y: A.pos.y + (out.y - A.pos.y) * k });
    return metres;
  }
  if (halt) { // SD3–SD5: a shut barrier is on the next way: walk only up to it (0 once there), never through
    if (leg <= EPS) return 0;
    step(a, out);
    return leg;
  }
  // through the doorway; a walk to the zone itself goes ENTER_M on toward its centre, to its body's near edge (SZ19)
  let at = next.at, used = leg;
  if (next.zone.id === goal.zone && !goal.pos) {
    const c = centre(next.zone)!, d = flat(at, c), step = Math.min(enterM(state, walker), d, metres - leg);
    if (step > EPS) { at = { x: at.x + (c.x - at.x) * step / d, y: at.y + (c.y - at.y) * step / d }; used += step; }
  }
  enter(at);
  return used;
}

/** SZ19: how far past a doorway a body's middle stands: ENTER_M to its near edge, so a whole horse stands inside
 * (half its length more; it walks in facing the room) */
const enterM = (state: GameState, a?: Actor): number => CONFIG.ENTER_M + (a ? actorBody(state, a).size.lengthM / 2 : 0);
/** SZ19: how far from a wall a body's middle stands: ENTER_M to its edge, whichever way it is turned */
const wallM = (state: GameState, a?: Actor): number => CONFIG.ENTER_M + (a ? Math.max(actorBody(state, a).size.lengthM, actorBody(state, a).size.widthM) / 2 : 0);

/** BG-226: where someone (`who`) stands on coming into zone `zoneId` from the linked zone `fromId`: the doorway between them,
 * a step (ENTER_M) inside, as a walk through it ends. null without rectangles. */
export function entryPoint(state: GameState, zoneId: string, fromId: string, who?: Actor): Pos | null {
  const z = zoneById(state, zoneId), from = zoneById(state, fromId);
  if (!z?.rect || !from?.rect) return null;
  const at = crossing(from, z).at, c = centre(z)!, d = flat(at, c), m = Math.min(enterM(state, who), d);
  return d > EPS ? { x: at.x + (c.x - at.x) * m / d, y: at.y + (c.y - at.y) * m / d } : at;
}

/** BG-49: at story start outdoors, the player stands at the way from its zone into the building of the scenario's place (`placeId`; else any other
 * place), PLACE_SPACING_M back from it toward the zone's centre, as the openings tell it (arriving at the door) */
export function startAtDoor(state: GameState, placeId?: string): void {
  const p = state.player, z = zoneById(state, p.zone);
  if (!z?.rect || !z.outdoor) return; // starting indoors: already in
  const others = z.links.map((l) => zoneById(state, l.to)).filter((b): b is Zone => !!b?.rect && !b.outdoor && b.placeId !== z.placeId);
  const b = others.find((o) => o.placeId === placeId) ?? others[0];
  if (!b) return;
  const out = crossing(z, b).out, c = centre(z)!, d = flat(out, c);
  const k = d > EPS ? Math.min(1, CONFIG.PLACE_SPACING_M / d) : 0;
  p.pos = { x: out.x + (c.x - out.x) * k, y: out.y + (c.y - out.y) * k };
}

/** BG-47: metres still to walk from `a` to the way out of its zone toward `goal` (undefined without positions or a way) */
export function wayLeftM(state: GameState, a: Located, goal: string, walker?: Actor): number | undefined {
  const A = spotOf(state, a);
  if (!A.pos || A.zone === goal) return undefined;
  const next = route(state, A, { zone: goal }, walker)?.[0];
  const out = next?.out ?? next?.at;
  return out ? flat(A.pos, out) : undefined;
}

/** TV3: where a frontier off a road is: the middle of the road's side its label's compass names, else the far end of the
 * road from `from` */
export function frontierPoint(z: Zone, label: string, from: Pos): Pos {
  const r = z.rect!;
  const d = compassOf(label);
  if (d) return edgeToward(r, d);
  const ends: Pos[] = r.w >= r.d ? [{ x: r.x - r.w / 2, y: r.y }, { x: r.x + r.w / 2, y: r.y }] : [{ x: r.x, y: r.y - r.d / 2 }, { x: r.x, y: r.y + r.d / 2 }];
  return ends.sort((p, q) => Math.hypot(q.x - from.x, q.y - from.y) - Math.hypot(p.x - from.x, p.y - from.y))[0];
}

/** BG-81: a spot's words (said as reached: "at the gate", "away from the door", "on the north side", "to a spot in the
 * yard") for a walk that stopped before it: "toward the gate", "heading away from the door", "toward the north side" */
export function spotOnTheWay(words: string): string {
  return words.startsWith('at ') || words.startsWith('to ') ? `toward ${words.slice(3)}` : words.startsWith('on the ') ? `toward the ${words.slice(7)}` : `heading ${words}`;
}

/** the point of the way out of zone `zoneId` to `to`: its doorway, or where a frontier is left; null without a rectangle
 * or such a way */
export function wayPoint(state: GameState, zoneId: string, to: string, from: Located): Pos | null {
  const z = zoneById(state, zoneId), link = z?.links.find((l) => l.to === to);
  if (!z?.rect || !link) return null;
  const there = zoneById(state, to);
  return there?.rect ? crossing(z, there).out : frontierPoint(z, link.label, spotOf(state, from).pos ?? centre(z)!); // BG-153: where the walk leaves, as route() has it
}

/** BG-12: the point a move spot names in zone `zoneId`, as seen from `from`: beside someone there (`near` an actor:
 * stopShort keeps PLACE_SPACING_M from them) or at a way out (`near` a link's zone: its doorway, a frontier's side); the far
 * edge straight across from someone or a way out (`awayFrom`); the middle of the side a compass word names (`side`); or an
 * exact point (`at`, AD16: picked on the minimap), kept inside the walls.
 * Points stand ENTER_M (a step) inside the edge. null: the zone has no rectangle, or the spot names nothing there. `toward` is the
 * actor walked to; `words` says the spot for the story ("to the north side", "away from the cellar steps"). */
export function spotPoint(state: GameState, zoneId: string, spot: MoveSpot, from: Located, walker?: Actor): { pos: Pos; stopShort: number; toward?: string; words?: string } | null {
  const z = zoneById(state, zoneId);
  if (!z?.rect) return null;
  const r = z.rect, c = centre(z)!;
  const start = spotOf(state, from).pos ?? c;
  const body = walker ?? ('core' in from ? (from as Actor) : undefined), wall = wallM(state, body); // SZ19: to its body's edge
  const inset = (p: Pos): Pos => {
    const dx = c.x - p.x, dy = c.y - p.y, len = Math.hypot(dx, dy), m = Math.min(wall, len);
    return len > EPS ? { x: p.x + (dx / len) * m, y: p.y + (dy / len) * m } : p;
  };
  /** a person in the zone, or a way out of it: where it is and what the story calls it */
  const point = (ref: string): { at: Pos; actor?: string; label?: string; here?: boolean } | null => {
    const who = actorById(state, ref);
    if (who && spot.lastSeen) { // BG-125: where the player last perceived them, never where they are now
      const j = state.player.journal, at = j?.lastSpot?.[who.id];
      // BG-203: the spot names whom it was, as the player knows them, never a bare "them"
      return at && j?.lastKnown?.[who.id] === z.id ? { at, label: `the spot where you last saw ${theOf(nameFor(state, state.player, who) ?? who.label)}` } : null;
    }
    if (who) { const s = spotOf(state, who); return s.pos ? { at: s.pos, actor: who.id, label: who.label, here: s.zone === z.id } : null; }
    const f = furnitureById(state, z.id, ref); // FR1: a piece of furniture here
    if (f) { const at = furniturePos(state, z.id, f); return at ? { at, label: `the ${f.name}` } : null; }
    const at = wayPoint(state, z.id, ref, from);
    return at ? { at, label: z.links.find((l) => l.to === ref)!.label } : null;
  };
  if (spot.at) { // AD16: the point itself, a step (ENTER_M) in from the walls at most, as the other spots stand
    const m = Math.min(wall, r.w / 2, r.d / 2), cl = (v: number, c0: number, half: number) => Math.max(c0 - half + m, Math.min(c0 + half - m, v));
    return { pos: { x: cl(spot.at.x, r.x, r.w / 2), y: cl(spot.at.y, r.y, r.d / 2) }, stopShort: 0, words: `to a spot in ${theName(z.name)}` };
  }
  if (spot.near) {
    const p = point(spot.near);
    if (!p || (p.actor && !p.here)) return null; // someone elsewhere is a move to their zone, not a spot in this one
    // BF35: a follow keeps its distance (followGap); a walk up to someone stops a step short of them
    const short = spot.follow && walker ? followGap(state, walker, spot.keep) : CONFIG.PLACE_SPACING_M;
    return p.actor ? { pos: p.at, stopShort: short, toward: p.actor } : { pos: inset(p.at), stopShort: 0, words: `at ${p.label}` };
  }
  if (spot.awayFrom) {
    const p = point(spot.awayFrom);
    if (!p) return null;
    let d: [number, number] = [c.x - p.at.x, c.y - p.at.y];
    // a way out at the middle (stairs straight up or down) has no far side: keep to the side the walker is already on
    if (Math.hypot(d[0], d[1]) <= EPS) d = [start.x - c.x, start.y - c.y];
    if (Math.hypot(d[0], d[1]) <= EPS) d = [0, 1];
    return { pos: inset(edgeToward(r, d)), stopShort: 0, words: `away from ${p.label}` };
  }
  const d = spot.side ? compassOf(spot.side) : null;
  return d ? { pos: inset(edgeToward(r, d)), stopShort: 0, words: `on the ${spot.side!.toLowerCase()} side` } : null;
}

/** SD3–SD5: the barrier on the next way of `a`'s walk to `goal`, when it is not simply open to `a` */
export function gateAhead(state: GameState, a: Actor, goal: string): { b: Barrier; to: string; pass: Passage } | null {
  if (goal === a.zone) return null;
  const next = wayPath(state, a.zone, goal, a)?.[0];
  const b = next ? barrierOn(state, zoneById(state, a.zone)?.links.find((l) => l.to === next)) : undefined;
  const pass = b ? passage(b, a, a.zone) : 'open';
  return b && next && pass !== 'open' ? { b, to: next, pass } : null;
}

/** FR2: `at` is within the actor's grip reach, plus `extra` metres (the receiver's own reach when handing over) */
export function withinGrip(state: GameState, actor: Actor, at: Located, extra = 0): boolean {
  const r = gripReachM(state, actor);
  return r > 0 && withinM(distM(state, actor, at), r + extra) && gripReaches(state, actor.zone, at.zone);
}
/** BF12: a grip reaches from zone a into zone b: the same zone, or every way between them lets a grip through (gripPasses) */
function gripReaches(state: GameState, a: string, b: string): boolean {
  if (a === b) return true;
  const path = shortestPath(state, a, b);
  let from = a;
  for (const z of path ?? []) {
    if (!gripPasses(barrierOn(state, zoneById(state, from)?.links.find((l) => l.to === z)))) return false;
    from = z;
  }
  return true;
}
