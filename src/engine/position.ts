// ZP1–ZP4, PZ1–PZ8, D-1623: everyone on stage stands at a point in metres on the map, at a height of its own (Actor.floor);
// its title (Located.zone) is a cache code keeps: the smallest title that holds the point at that height (plan/where zoneAt). Distance between two people is the
// straight line when nothing stops sight between their eyes (plan/line lineClear: walls, shut doors, roofs), else the
// walking path round the walls and through the ways (plan/path walkPath).
// SZ4, SZ5: a person takes up room: a capsule on the floor (its size from actorBody), turned the way it faces, as tall as
// it stands. Every distance between two people is the gap between their bodies; to a spot, from the body's edge. The
// first one measured from turns toward the other (as it does to strike, look or speak); the other keeps its facing.
import { CONFIG } from '../config';
import { compassOf } from '../scenario/geometry';
import { furnitureById, furniturePos } from './furniture';
import { FU } from '../library/tableIds';
import { actorById, allActors, nameFor, zoneById } from './relations';
import { theName, theOf } from '../words';
import { barrierOn, gripPasses, passage, type Passage } from './barriers';
import { gripReachM } from '../ruleset/body';
import { actorBody } from '../library';
import { sightFactor } from '../library/bodySize';
import { followGap } from './follow';
import { dist, keepInside, lerp, NEAR_M, sidesOf, crossing as segCross } from '../plan/geom';
import { inSpan, inTitle, middle, roofed, sideOfOpening, wayTo, zoneAt } from '../plan/where';
import { crossings, lineClear } from '../plan/line';
import { walkPath, type WalkPath } from '../plan/path';
import { wallKind } from '../plan/walls';
import type { Actor, Barrier, GameState, MoveSpot, Opening, Pt3, Zone } from '../types';

export type Pos = { x: number; y: number };
/** someone or something that stands somewhere: a title, and a point in it; an actor's own height (D-1623) */
export type Located = { zone: string; pos?: Pos; floor?: number };

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
/** a title's middle, kept inside its outline (an L-shaped room's centroid may fall outside it) */
const centre = (z: Zone): Pos => keepInside(middle(z), z.outline, 0);
/** p lies in title z's footprint, give or take M_EPS */
export const inside = (z: Zone, p: Pos) => inTitle(z, p, EPS);
const flat = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (A: Pos, B: Pos): [number, number] | undefined => { const d = flat(A, B); return d > EPS ? [(B.x - A.x) / d, (B.y - A.y) / d] : undefined; };
/** PZ7, D-1623: the floor someone stands on: its own height; a spot with none, its title's */
export const floorOf = (state: GameState, a: Located): number => a.floor ?? zoneById(state, a.zone)?.floor ?? 0;
/** D-1623: an actor's point and height (where an event it makes happens) */
export const standingAt = (a: Actor): Pt3 => ({ x: a.pos.x, y: a.pos.y, floor: a.floor });
/** D-1623: where an actor stands, as a copy: its title, point and height */
export const placeOf = (a: Actor): Located => ({ zone: a.zone, pos: { ...a.pos }, floor: a.floor });
/** D-1623: the point and height of a title's middle (where someone put in it with no point of its own starts) */
export const titleMiddle = (z: Zone): Pt3 => ({ ...(z.outline?.length ? centre(z) : { x: 0, y: 0 }), floor: z.floor });

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
/** the fewest metres a and b can be apart by any measure here (floorGap, the sight line, a walking path; all body edge to
 * body edge): the flat line between their points, less each body's farthest reach from its point (half its longer side),
 * and less M_EPS for rounding. A walk is never shorter than that line, since every leg of it is at least as long as its
 * own straight line. 0 where a title has no footprint, so a check using it falls through to the full measure. */
export function leastGapM(state: GameState, a: Located, b: Located): number {
  const pa = spotOf(state, a).pos, pb = spotOf(state, b).pos;
  if (!pa || !pb) return 0;
  const reach = (x: Located) => (isActor(x) ? Math.max(actorBody(state, x).size.lengthM, actorBody(state, x).size.widthM) / 2 : 0);
  return Math.max(0, flat(pa, pb) - reach(a) - reach(b) - M_EPS);
}
/** SZ5: the gap on the floor between what stands at a and b, wherever they are (spots, people) */
export function floorGap(state: GameState, a: Located, b: Located): number {
  const pa = pointOf(state, a), pb = pointOf(state, b);
  return shapeGap(shapeOf(state, a, pa, unit(pa, pb)), shapeOf(state, b, pb));
}

/** where it stands: its own point (and height) while that lies in its title, else the title's middle; in a title not
 * drawn, its own point (D-1623: a title never takes the point away) */
export function spotOf(state: GameState, a: Located): Located {
  const z = zoneById(state, a.zone), own = { zone: a.zone, ...(a.pos ? { pos: a.pos } : {}), ...(a.floor !== undefined ? { floor: a.floor } : {}) };
  if (!z?.outline?.length) return own;
  return a.pos && inside(z, a.pos) ? own : { zone: a.zone, pos: centre(z) };
}

/** PZ1: the point where it stands (spotOf); a title with no footprint is a world-building bug */
function pointOf(state: GameState, a: Located): Pos {
  const p = spotOf(state, a).pos;
  if (!p) throw noOutline({ id: a.zone });
  return p;
}
/** the point where it stands with its floor */
export function pointAt(state: GameState, a: Located): Pt3 {
  const p = pointOf(state, a);
  return { x: p.x, y: p.y, floor: floorOf(state, a) };
}
/** PZ1: a title with no footprint is a world-building bug */
const noOutline = (z: { id: string }) => new Error(`title ${z.id} has no outline: distances are metres between points`);

/** PZ1 a: the title a point in title z belongs to: the smallest that holds it (z, or a smaller one inside it) */
const titleIn = (state: GameState, z: Zone, p: Pos): string => zoneAt(state, p, z.floor, z.id)?.id ?? z.id;

/** ZP1: gives everyone on stage whose point is outside its title (or off its floors), or who was just put in it
 * (`unplaced`, `withPlayer`), a free spot in it on its floor: where placement starts (anchor), else the nearest point on a
 * half-PLACE_SPACING_M grid around it whose body keeps PLACE_SPACING_M from everyone already standing there (SZ6: body to
 * body), never in a smaller title inside it. `withPlayer`: the ids of those who just arrived with the player (GSM-51).
 * PZ1: anyone whose point lies in a smaller title inside its own is in that one (Actor.zone is a cache of zoneAt). D-1623:
 * in a title with no outline everyone keeps their own point. */
export function placeAll(state: GameState, withPlayer: readonly string[] = []): void {
  const gap = CONFIG.PLACE_SPACING_M;
  const people = allActors(state);
  for (const a of people) {
    const z = zoneById(state, a.zone);
    if (!z?.outline?.length) continue;
    const fresh = a.unplaced || withPlayer.includes(a.id);
    delete a.unplaced;
    if (!fresh && inside(z, a.pos) && inSpan(z, a.floor)) {
      const t = zoneAt(state, a.pos, a.floor, z.id)?.id ?? z.id;
      if (t !== a.zone) { a.zone = t; a.placeId = zoneById(state, t)?.placeId ?? a.placeId; }
      continue;
    }
    const taken = people.filter((o) => o !== a && o.zone === a.zone && o.pos && inside(z, o.pos)).map((o) => shapeOf(state, o, o.pos!));
    const c = anchor(state, z, withPlayer.includes(a.id));
    let spot = c;
    const step = gap / 2; // SZ6: a finer grid than the spacing, so bodies of any width find the nearest free spot
    for (let r = 0; r <= 100; r++) {
      let best: Pos | undefined; // the nearest free point of this ring
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const p = { x: c.x + i * step, y: c.y + j * step };
        if ((!best || flat(p, c) < flat(best, c)) && inside(z, p) && titleIn(state, z, p) === z.id && taken.every((t) => shapeGap(shapeOf(state, a, p), t) >= gap - EPS)) best = p; // SZ6: bodies, edge to edge
      }
      if (best) { spot = best; break; }
    }
    a.pos = { ...spot };
    a.floor = z.floor;
  }
}

/** ZP1, D-1623: `a` was put in title `a.zone` with no spot there yet: it stands at the title's middle on its floor until
 * placeAll gives it a free spot */
export function unplace(state: GameState, a: Actor): void {
  const z = zoneById(state, a.zone);
  if (z?.outline?.length) { const m = titleMiddle(z); a.pos = { x: m.x, y: m.y }; a.floor = m.floor; }
  a.unplaced = true;
}

/** where placeAll starts looking in a title: the player's point for one who arrived with the player (GSM-51); an
 * encounter's point on the road (TV4); on a road, the player's point; else the title's middle */
function anchor(state: GameState, z: Zone, withPlayer: boolean): Pos {
  const e = state.stage.encounter, p = state.player, byPlayer = p.zone === z.id && p.pos && inside(z, p.pos);
  if (withPlayer && byPlayer) return p.pos!;
  if (e && e.zone === z.id && inside(z, e.at)) return e.at;
  if (z.line?.length && byPlayer) return p.pos!;
  return centre(z);
}

/** the eye of what stands at `x` (EYE_SHARE of its height above its floor); a spot is looked at at the eye height of
 * the one looking (`h`) */
const eyeOf = (state: GameState, x: Located, p: Pos, h: number) => ({ x: p.x, y: p.y, z: floorOf(state, x) + (isActor(x) ? actorBody(state, x).size.heightM * CONFIG.EYE_SHARE : h) });

/** PZ3 a: metres between two people with nothing stopping sight between their eyes (or from one's eye to a spot): the
 * straight line; Infinity without sight. What an attack reaches across (a blow or a shot never goes round a wall). SZ5:
 * the gap between their bodies, each standing from its floor to its height. */
export function sightDistM(state: GameState, a: Located, b: Located): number {
  const pa = pointOf(state, a), pb = pointOf(state, b), A = shapeOf(state, a, pa, unit(pa, pb)), B = shapeOf(state, b, pb);
  const ea = eyeOf(state, a, pa, 1.5), eb = eyeOf(state, b, pb, ea.z - floorOf(state, a));
  if (!lineClear(state, ea, eb)) return Infinity;
  const fa = floorOf(state, a), fb = floorOf(state, b);
  return Math.hypot(shapeGap(A, B), Math.max(0, fb - fa - A.h, fa - fb - B.h));
}

/** SZ11: how much farther `b` is seen from `a` than a person would be: its body's sightFactor at the look-down angle (a
 * floor above looking down on it); 1 for a spot. Sight ranges and the range penalty read distances ÷ this. */
export function seenSizeFactor(state: GameState, a: Located, b: Located): number {
  if (!('core' in b)) return 1;
  const drop = Math.max(0, floorOf(state, a) - floorOf(state, b));
  return sightFactor(actorBody(state, b as Actor).size, drop > 0 ? Math.atan2(drop, Math.max(floorGap(state, a, b), EPS)) : 0);
}

/** step 2 PR 2: how far away something is for sight, in metres: sightDistM ÷ how big it looks (SZ11: a horse is seen as
 * far again as a person at nearly twice the metres), never under NEAREST_M; null without sight */
export function seeingM(state: GameState, a: Located, b: Located): number | null {
  const d = sightDistM(state, a, b);
  return d === Infinity ? null : Math.max(d / seenSizeFactor(state, a, b), CONFIG.NEAREST_M);
}

/** PZ8: the walking path for `walker` (round ways shut to it that it knows of, then any way its body fits), or for no one
 * (any walked way) */
function walkFor(state: GameState, A: Pt3, B: Pt3, walker?: Actor): WalkPath | null {
  if (!walker) return walkPath(state, A, B);
  return walkPath(state, A, B, { walker, body: walker }) ?? walkPath(state, A, B, { body: walker });
}
/** SZ5: a walk's metres from A's body's edge to B's (a spot is a point) */
function walkGap(state: GameState, a: Located, b: Located, w: WalkPath): number {
  const pts = w.pts, n = pts.length, pa = pts[0], pb = pts[n - 1];
  if (n === 2) return Math.hypot(shapeGap(shapeOf(state, a, pa, unit(pa, pb)), shapeOf(state, b, pb)), Math.abs(pa.floor - pb.floor));
  const A = shapeOf(state, a, pa, unit(pa, pts[1])), B = shapeOf(state, b, pb);
  const mid = w.metres - flat(pa, pts[1]) - flat(pts[n - 2], pb);
  return pointGap(pts[1], A) + Math.max(0, mid) + pointGap(pts[n - 2], B);
}

/** ZP4: metres between two people (or a person and a spot): a straight line with sight between them, else the walking
 * path round the walls; Infinity with no way between them */
export function distM(state: GameState, a: Located, b: Located): number {
  const seen = sightDistM(state, a, b);
  if (seen < Infinity) return seen;
  return pathM(state, a, b);
}

/** distM, or null where a title on the way has no footprint: for checks that must not stop the turn */
export function distOrNull(state: GameState, a: Located, b: Located): number | null {
  try { return distM(state, a, b); } catch { return null; }
}

/** PZ8: metres from A to B by the walking path (for `walker`, round the ways it knows are shut), from A's body's edge to
 * B's (SZ5); Infinity with no way */
export function pathM(state: GameState, a: Located, b: Located, walker?: Actor): number {
  const w = walkFor(state, pointAt(state, a), pointAt(state, b), walker);
  return w ? walkGap(state, a, b, w) : Infinity;
}

/** PZ4: the walking path from a to b (anyone's: every walked way): its metres body to body and the ways it goes through;
 * null with none */
export function walkThrough(state: GameState, a: Located, b: Located): { metres: number; through: Opening[] } | null {
  const w = walkPath(state, pointAt(state, a), pointAt(state, b));
  return w ? { metres: walkGap(state, a, b, w), through: w.through } : null;
}

/** a walk's polyline cut where it crosses a title's edge, each piece with the title it runs through (a climb: the title
 * at its top) */
type Piece = { p: Pt3; q: Pt3; m: number; zone?: string; climb?: boolean };
function piecesOf(state: GameState, pts: Pt3[], from: string): Piece[] {
  const out: Piece[] = [];
  let cur = from;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (Math.abs(p.floor - q.floor) > 0.01) { // stairs, a ladder, a hatch: the climb, into the title at its far end
      const z = zoneAt(state, q, q.floor, cur)?.id;
      out.push({ p, q, m: flat(p, q) + Math.abs(q.floor - p.floor), ...(z ? { zone: z } : {}), climb: true });
      if (z) cur = z;
      continue;
    }
    const ts = [0, 1];
    for (const z of state.zones) {
      if (!z.outline?.length || p.floor < z.floor - 0.01 || p.floor >= z.top - 0.01) continue;
      for (const [a, b] of sidesOf(z.outline)) { const x = segCross(p, q, a, b); if (x && x.t > 1e-6 && x.t < 1 - 1e-6 && x.u >= -1e-6 && x.u <= 1 + 1e-6) ts.push(x.t); }
    }
    ts.sort((x, y) => x - y);
    const L = flat(p, q);
    for (let k = 0; k + 1 < ts.length; k++) {
      if ((ts[k + 1] - ts[k]) * L <= NEAR_M && k + 2 < ts.length) continue; // two edges at one point (a corner): one cut
      const a = { ...lerp(p, q, ts[k]), floor: p.floor }, b = { ...lerp(p, q, ts[k + 1]), floor: p.floor };
      const m = flat(a, b);
      if (m <= NEAR_M / 10 && out.length) continue;
      const z = zoneAt(state, lerp(a, b, 0.5), p.floor, cur)?.id;
      out.push({ p: a, q: b, m, ...(z ? { zone: z } : {}) });
      if (z) cur = z;
    }
  }
  return out;
}
/** the titles a walk's pieces pass after `from`, in order */
function titlesOf(pieces: Piece[], from: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (const pc of pieces) if (pc.zone && pc.zone !== cur) { out.push(pc.zone); cur = pc.zone; }
  return out;
}

/** AD16: the walk from A to B as walkLeg walks it (the walker's way round shut ways it knows; else the plain path): the
 * titles after A's, its points from A's to B's, and its metres; null with no way */
export function walkRoute(state: GameState, a: Located, b: Located, walker?: Actor): { path: string[]; pts: Pos[]; metres: number } | null {
  const B = b.pos ? pointAt(state, b) : { ...centreOf(state, b.zone), floor: floorOf(state, b) };
  const w = walkFor(state, pointAt(state, a), B, walker);
  if (!w) return null;
  const pieces = piecesOf(state, w.pts, a.zone);
  // the walker's own walk, centre to point (no body's edge taken off: what the walk walks)
  return { path: titlesOf(pieces, a.zone), pts: w.pts.map((p) => ({ x: p.x, y: p.y })), metres: walkGap(state, { zone: a.zone, pos: w.pts[0] }, { zone: b.zone, pos: B }, w) };
}
const centreOf = (state: GameState, zoneId: string): Pos => { const z = zoneById(state, zoneId); if (!z?.outline?.length) throw noOutline({ id: zoneId }); return centre(z); };
/** the point a walk to `goal` heads for: its spot, else its title's centre */
export const goalPoint = (state: GameState, goal: Located): Pt3 => (goal.pos ? pointAt(state, goal) : { ...centreOf(state, goal.zone), floor: floorOf(state, goal) });

/** a step of a walk to `to`: the walker now faces the way it walked (BG-18: "the slime on the left") */
function step(a: { pos?: Pos; floor?: number; facing?: [number, number] }, to: Pos | Pt3): void {
  const from = a.pos, d = from ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  if (from && d > EPS) a.facing = [(to.x - from.x) / d, (to.y - from.y) / d];
  a.pos = { x: to.x, y: to.y };
  if ('floor' in to && a.floor !== undefined) a.floor = to.floor; // D-1623: a climb carries its own height
}

/** SZ4: the actor turns to face what it strikes or speaks to (turning never collides) */
export function faceToward(a: Actor, at: Located): void {
  const d = a.pos && at.pos ? unit(a.pos, at.pos) : undefined;
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

/** BF35/BF71: everyone else in the walker's title whose spot a walk's end keeps PLACE_GAP_M from: all of them (none is let
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
 * PLACE_GAP_M from everyone else in its title */
function roomAt(state: GameState, walker: Actor, A: Pos, B: Pos, go: number, d: number, toward?: string): number {
  const others = othersFor(state, walker, toward), dir = unit(A, B);
  const at = (t: number): Pos => ({ x: A.x + (B.x - A.x) * t / d, y: A.y + (B.y - A.y) * t / d });
  let t = go;
  for (let i = 0; i < 400 && t > EPS && !free(state, walker, others, at(t), dir); i++) t = Math.max(0, t - CONFIG.PLACE_GAP_M / 10);
  return t;
}

/** BF71: the free spots, nearest to `from` first, round `target` (standing at B) where the walker's body, facing it, is `r`
 * metres from its body (SZ5) inside the walker's title, keeping PLACE_GAP_M from everyone but `toward` (RING_STEPS
 * directions round it) */
function ringSpots(state: GameState, walker: Actor, target: Located, B: Pos, r: number, from: Pos, toward?: string): Pos[] {
  const z = zoneById(state, walker.zone);
  if (!z?.outline?.length || r <= EPS) return [];
  const others = othersFor(state, walker, toward), G = shapeOf(state, target, B);
  const me = shapeOf(state, walker, B), far = r + 2 * (me.half + me.r + G.half + G.r) + 1;
  const out: Pos[] = [];
  for (let i = 0; i < CONFIG.RING_STEPS; i++) {
    const t = (2 * Math.PI * i) / CONFIG.RING_STEPS, c = Math.cos(t), sn = Math.sin(t);
    const at = (k: number): Pos => ({ x: B.x + k * c, y: B.y + k * sn }), dir: [number, number] = [-c, -sn];
    const k = lastTrue((m) => shapeGap(shapeOf(state, walker, at(far - m), dir), G) >= r, 0, far); // walking in from far out
    const p = at(far - k);
    if (inside(z, p) && free(state, walker, others, p, dir) && lineClear(state, { ...from, z: z.floor + 0.3 }, { ...p, z: z.floor + 0.3 })) out.push(p);
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

/** the last straight stretch of a walk at the goal's point: straight at it, stopping `stopShort` metres before it (SZ5:
 * body to body), never on someone (BF35), round to a free spot at that reach when closing in (BF71); at most `metres` */
function approach(state: GameState, a: Located, goal: Located, B: Pos, metres: number, stopShort: number, walker?: Actor, toward?: string): number {
  const A = pointOf(state, a), d = flat(A, B);
  const dir = unit(A, B), G = shapeOf(state, goal, B);
  const end = d <= EPS ? 0 : lastTrue((t) => shapeGap(shapeOf(state, a, { x: A.x + (B.x - A.x) * t / d, y: A.y + (B.y - A.y) * t / d }, dir), G) >= stopShort, 0, d);
  let go = Math.min(metres, end);
  if (walker && go >= end - EPS) {
    const room = roomAt(state, walker, A, B, go, d, toward);
    if (toward && room < go - EPS) {
      const p = ringSpots(state, walker, goal, B, stopShort, A, toward).find((x) => flat(A, x) <= metres + EPS);
      if (p) { const m = flat(A, p); if (m <= EPS) return 0; step(a, p); return m; }
    }
    go = room;
  }
  if (go <= EPS) return 0;
  step(a, { x: A.x + (B.x - A.x) * go / d, y: A.y + (B.y - A.y) * go / d });
  return go;
}

/** SZ19: how far past a doorway a body's middle stands: ENTER_M to its near edge, so a whole horse stands inside
 * (half its length more; it walks in facing the room) */
const enterM = (state: GameState, a?: Actor): number => CONFIG.ENTER_M + (a ? actorBody(state, a).size.lengthM / 2 : 0);
/** SZ19: how far from a wall a body's middle stands: ENTER_M to its edge, whichever way it is turned */
const wallM = (state: GameState, a?: Actor): number => CONFIG.ENTER_M + (a ? Math.max(actorBody(state, a).size.lengthM, actorBody(state, a).size.widthM) / 2 : 0);

/** SD3–SD5: the barrier the walk would cross next, if it is not simply open to the walker: its opening */
function gateOf(state: GameState, a: Actor, w: WalkPath): { o: Opening; b: Barrier; pass: Passage; from: string } | null {
  const o = w.through[0];
  const b = o ? barrierOn(state, o) : undefined;
  if (!o || !b) return null;
  const from = sideOfOpening(o, a.zone) >= 0 ? a.zone : o.joins[0];
  const pass = passage(b, a, from);
  return pass === 'open' ? null : { o, b, pass, from };
}
/** the point of an opening on a title's side of it (stairs and passages: their end on that title's floor) */
function endOn(o: Opening, zoneId: string): Pos {
  return o.to && sideOfOpening(o, zoneId) === 1 ? o.to : o.at;
}

/** how far short of a shut way a walk stops, in metres (SD3) */
const GATE_SHORT_M = 0.1;
/** ZP2, PZ8: one leg of a walk toward `goal`: along the walking path until it crosses into the next title (entering it),
 * or, at the path's last straight stretch, straight at the goal's point, stopping `stopShort` metres before it. A goal
 * with no point is the title itself: the walk ends ENTER_M past where it comes in. At most `metres` are walked. Returns
 * the metres walked (0: nothing left to walk), or null when there is no way. `halt` (SD3–SD5): a barrier not open to the
 * walker is on the way: walk up to it (0 once there), never through. */
export function walkLeg(state: GameState, a: Located & { placeId?: string; facing?: [number, number] }, goal: Located, metres: number, stopShort = 0, walker?: Actor, halt = false, toward?: string): number | null {
  if (a.zone === goal.zone && !goal.pos) return 0;
  const A = pointAt(state, a);
  const B: Pt3 = goal.pos ? pointAt(state, goal) : { ...centreOf(state, goal.zone), floor: floorOf(state, goal) };
  const body = walker ?? (isActor(a) ? a : undefined);
  const w = walkFor(state, A, B, body);
  if (!w) return null;
  const gate = halt && body ? gateOf(state, body, w) : null;
  const pieces = piecesOf(state, w.pts, a.zone);
  let used = 0;
  const enter = (zoneId: string) => { const z = zoneById(state, zoneId); if (!z) return; a.zone = z.id; a.placeId = z.placeId; };
  for (let k = 0; k < pieces.length; k++) {
    const pc = pieces[k], left = metres - used;
    const into = pc.zone && pc.zone !== a.zone ? pc.zone : undefined;
    if (into && gate && (pc.climb ? dist(pc.p, gate.o.at) <= 1 : dist(pc.p, gate.o.at) <= gate.o.widthM / 2 + 0.5)) { // SD3: up to the gate
      // a hand's breadth short of it, on this side: standing in the doorway itself would be past it to every later walk
      const back = k > 0 ? Math.min(GATE_SHORT_M, pieces[k - 1].m) : 0;
      if (back > 0 && a.pos) step(a, lerp(pc.p, pieces[k - 1].p, back / pieces[k - 1].m));
      return used - back > EPS ? used - back : 0;
    }
    if (pc.climb) { // a climb is walked whole once begun from its foot (the next leg starts at the top)
      if (used > 0 && pc.m > left + EPS) return used;
      step(a, pc.q);
      enter(pc.zone ?? a.zone);
      return used + pc.m;
    }
    if (into) {
      enter(into);
      if (into === goal.zone && !goal.pos) return used + walkOn(pieces, k, Math.min(enterM(state, walker), left));
      return used;
    }
    if (k === pieces.length - 1 && goal.pos) return used + approach(state, a, goal, B, left, stopShort, walker, toward);
    if (pc.m > left + EPS) {
      if (left <= EPS) return used;
      if (gate && halt) { /* the gate is further on: walk what there is */ }
      step(a, lerp(pc.p, pc.q, left / pc.m));
      return metres;
    }
    step(a, pc.q);
    used += pc.m;
  }
  return used;
  /** walks on `m` metres along the pieces from piece k (staying in the title entered), returning the metres walked */
  function walkOn(ps: Piece[], k: number, m: number): number {
    let done = 0;
    for (let i = k; i < ps.length && done < m - EPS; i++) {
      const pc = ps[i];
      if (pc.climb || (pc.zone && pc.zone !== a.zone)) break;
      const go = Math.min(pc.m, m - done);
      step(a, go >= pc.m - EPS ? pc.q : lerp(pc.p, pc.q, go / pc.m));
      done += go;
    }
    return done;
  }
}

/** BG-226: where someone (`who`) stands on coming into title `zoneId` from the title `fromId`: the way between them, a
 * step (ENTER_M) inside, as a walk through it ends. null without footprints or a way. */
export function entryPoint(state: GameState, zoneId: string, fromId: string, who?: Actor): Pos | null {
  const z = zoneById(state, zoneId), from = zoneById(state, fromId);
  if (!z?.outline?.length || !from?.outline?.length) return null;
  const way = wayTo(state, zoneId, fromId);
  const at = way ? endOn(way.opening, zoneId) : keepInside(middle(from), z.outline, 0);
  const c = centre(z), d = flat(at, c), m = Math.min(enterM(state, who), d);
  return d > EPS ? { x: at.x + (c.x - at.x) * m / d, y: at.y + (c.y - at.y) * m / d } : at;
}

/** BG-49: at story start outdoors, the player stands at the way from its title into the building of the scenario's place
 * (`placeId`; else any other place), PLACE_SPACING_M back from it toward the title's middle (arriving at the door) */
export function startAtDoor(state: GameState, placeId?: string): void {
  const p = state.player, z = zoneById(state, p.zone);
  if (!z?.outline?.length || roofed(state, z)) return; // starting indoors: already in
  const ways = state.openings.filter((o) => !o.frontier && sideOfOpening(o, z.id) >= 0).map((o) => ({ o, b: zoneById(state, o.joins[1 - sideOfOpening(o, z.id)]) }))
    .filter((x): x is { o: Opening; b: Zone } => !!x.b?.outline?.length && roofed(state, x.b) && x.b.placeId !== z.placeId);
  const way = ways.find((x) => x.b.placeId === placeId) ?? ways[0];
  if (!way) return;
  const out = endOn(way.o, z.id), c = centre(z), d = flat(out, c);
  const k = d > EPS ? Math.min(1, CONFIG.PLACE_SPACING_M / d) : 0;
  p.pos = { x: out.x + (c.x - out.x) * k, y: out.y + (c.y - out.y) * k };
}

/** BG-47: metres still to walk from `a` to where its walk toward `goal` leaves its title; `enter` (AT49, BG-1545): to where it
 * gets into `goal`, where a walk to a title ends (walkThere), a climb up into it included (undefined without a way) */
export function wayLeftM(state: GameState, a: Located, goal: string, walker?: Actor, enter = false): number | undefined {
  const A = spotOf(state, a);
  if (!A.pos || A.zone === goal || !zoneById(state, goal)?.outline?.length) return undefined;
  const w = walkFor(state, pointAt(state, a), { ...centreOf(state, goal), floor: floorOf(state, { zone: goal }) }, walker);
  if (!w) return undefined;
  let m = 0;
  for (const pc of piecesOf(state, w.pts, a.zone)) {
    if (enter ? pc.zone === goal : pc.climb || (pc.zone && pc.zone !== a.zone)) return enter && pc.climb ? m + pc.m : m;
    m += pc.m;
  }
  return undefined;
}

/** TV3: where the way out of title `zoneId` to the frontier `key` is left (its opening's spot); null without one */
export function frontierPoint(state: GameState, zoneId: string, key: string): Pos | null {
  const o = state.openings.find((x) => x.frontier && x.joins[0] === zoneId && x.joins[1] === key);
  return o && Number.isFinite(o.at.x) ? o.at : null;
}

/** BG-81: a spot's words (said as reached: "at the gate", "away from the door", "on the north side", "to a spot in the
 * yard") for a walk that stopped before it: "toward the gate", "heading away from the door", "toward the north side" */
export function spotOnTheWay(words: string): string {
  return words.startsWith('at ') || words.startsWith('to ') ? `toward ${words.slice(3)}` : words.startsWith('on the ') ? `toward the ${words.slice(7)}` : `heading ${words}`;
}

/** the point of the way out of title `zoneId` to `to` (a title or a frontier key): its opening on this title's side;
 * null without such a way */
export function wayPoint(state: GameState, zoneId: string, to: string, _from?: Located): Pos | null {
  const w = wayTo(state, zoneId, to);
  if (!w || !Number.isFinite(w.opening.at.x)) return null;
  return endOn(w.opening, zoneId);
}

/** the point of an outline's edge straight out from its middle along `d` (the farthest crossing of that ray) */
function edgeOut(z: Zone, d: [number, number]): Pos {
  const m = centre(z), far = { x: m.x + d[0] * 1e5, y: m.y + d[1] * 1e5 };
  let best = 0;
  for (const [a, b] of sidesOf(z.outline)) { const x = segCross(m, far, a, b); if (x && x.u >= -1e-9 && x.u <= 1 + 1e-9 && x.t > best) best = x.t; }
  return best > 0 ? lerp(m, far, best) : m;
}

/** BG-12: the point a move spot names in title `zoneId`, as seen from `from`: beside someone there (`near` an actor:
 * stopShort keeps PLACE_SPACING_M from them) or at a way out (`near` a way's title: its opening, a frontier's spot); the far
 * edge straight across from someone or a way out (`awayFrom`); the middle of the side a compass word names (`side`); or an
 * exact point (`at`, AD16: picked on the minimap), kept inside the walls.
 * Points stand ENTER_M (a step) inside the edge. null: the title has no footprint, or the spot names nothing there. `toward` is the
 * actor walked to; `words` says the spot for the story ("to the north side", "away from the cellar steps"). */
export function spotPoint(state: GameState, zoneId: string, spot: MoveSpot, from: Located, walker?: Actor): { pos: Pos; stopShort: number; toward?: string; words?: string } | null {
  const z = zoneById(state, zoneId);
  if (!z?.outline?.length) return null;
  const c = centre(z);
  const start = spotOf(state, from).pos ?? c;
  const body = walker ?? ('core' in from ? (from as Actor) : undefined), wall = wallM(state, body); // SZ19: to its body's edge
  const inset = (p: Pos): Pos => {
    const dx = c.x - p.x, dy = c.y - p.y, len = Math.hypot(dx, dy), m = Math.min(wall, len);
    return len > EPS ? keepInside({ x: p.x + (dx / len) * m, y: p.y + (dy / len) * m }, z.outline, 0) : p;
  };
  /** a person in the title, or a way out of it: where it is and what the story calls it */
  const point = (ref: string): { at: Pos; actor?: string; label?: string; here?: boolean; onto?: true } | null => {
    const who = actorById(state, ref);
    if (who && spot.lastSeen) { // BG-125: where the player last perceived them, never where they are now
      const j = state.player.journal, at = j?.lastSpot?.[who.id];
      // BG-203: the spot names whom it was, as the player knows them, never a bare "them"
      return at && j?.lastKnown?.[who.id] === z.id ? { at, label: `the spot where you last saw ${theOf(nameFor(state, state.player, who) ?? who.label)}` } : null;
    }
    if (who) { const s = spotOf(state, who); return s.pos ? { at: s.pos, actor: who.id, label: who.label, here: s.zone === z.id } : null; }
    const f = furnitureById(state, z.id, ref); // FR1: a piece of furniture here
    if (f) { const at = furniturePos(state, z.id, f); return at ? { at, label: `the ${f.name}`, ...(f.kind === FU.bed ? { onto: true as const } : {}) } : null; } // MQ13 a: a bed is walked onto
    const w = wayTo(state, z.id, ref);
    const at = wayPoint(state, z.id, ref, from);
    return at && w ? { at, label: w.label } : null;
  };
  if (spot.at) return { pos: keepInside(spot.at, z.outline, wall), stopShort: 0, words: `to a spot in ${theName(z.name)}` }; // AD16: a step (ENTER_M) in from the walls at most
  if (spot.near) {
    const p = point(spot.near);
    if (!p || (p.actor && !p.here)) return null; // someone elsewhere is a move to their title, not a spot in this one
    // BF35: a follow keeps its distance (followGap); a walk up to someone stops a step short of them
    const short = spot.follow && walker ? followGap(state, walker, spot.keep) : CONFIG.PLACE_SPACING_M;
    return p.actor ? { pos: p.at, stopShort: short, toward: p.actor } : { pos: p.onto ? p.at : inset(p.at), stopShort: 0, words: `${p.onto ? 'onto' : 'at'} ${p.label}` };
  }
  if (spot.awayFrom) {
    const p = point(spot.awayFrom);
    if (!p) return null;
    let d: [number, number] = [c.x - p.at.x, c.y - p.at.y];
    // a way out at the middle (stairs straight up or down) has no far side: keep to the side the walker is already on
    if (Math.hypot(d[0], d[1]) <= EPS) d = [start.x - c.x, start.y - c.y];
    if (Math.hypot(d[0], d[1]) <= EPS) d = [0, 1];
    const L = Math.hypot(d[0], d[1]);
    return { pos: inset(edgeOut(z, [d[0] / L, d[1] / L])), stopShort: 0, words: `away from ${p.label}` };
  }
  const d = spot.side ? compassOf(spot.side) : null;
  return d ? { pos: inset(edgeOut(z, d)), stopShort: 0, words: `on the ${spot.side!.toLowerCase()} side` } : null;
}

/** SD3–SD5: the barrier on the next way of `a`'s walk to `goal`, when it is not simply open to `a`: the barrier, the title
 * beyond it and how it lets `a` by */
export function gateAhead(state: GameState, a: Actor, goal: string): { b: Barrier; to: string; pass: Passage; opening: Opening } | null {
  if (goal === a.zone || !zoneById(state, goal)?.outline?.length) return null;
  const w = walkFor(state, pointAt(state, a), { ...centreOf(state, goal), floor: floorOf(state, { zone: goal }) }, a);
  const g = w ? gateOf(state, a, w) : null;
  if (!g) return null;
  const i = sideOfOpening(g.o, g.from);
  return { b: g.b, to: g.o.joins[i === 1 ? 0 : 1], pass: g.pass, opening: g.o };
}

/** FR2: `at` is within the actor's grip reach, plus `extra` metres (the receiver's own reach when handing over) */
export function withinGrip(state: GameState, actor: Actor, at: Located, extra = 0): boolean {
  const r = gripReachM(state, actor);
  return r > 0 && withinM(distM(state, actor, at), r + extra) && gripReaches(state, actor, at);
}
/** BF12: a grip reaches from where `a` stands to `b`: in the same title; or the straight line at hand height crosses only
 * walls reached across (a counter, a fence) and ways that let a grip through (gripPasses); or every way on the walk does */
function gripReaches(state: GameState, a: Actor, b: Located): boolean {
  if (a.zone === b.zone) return true;
  const A = pointAt(state, a), B = pointAt(state, b);
  const line = crossings(state, { x: A.x, y: A.y, z: A.floor + 1 }, { x: B.x, y: B.y, z: B.floor + 1 });
  if (line.every((c) => c.kind === 'wall' && (c.opening ? gripPasses(barrierOn(state, c.opening)) : !!wallKind(c.wall.kind)?.reach))) return true;
  const w = walkPath(state, A, B);
  return !!w && w.through.every((o) => gripPasses(barrierOn(state, o)));
}
