// ZP1–ZP4 (step 2): everyone on stage stands at a point in metres on the map, in the frame of the zones' rectangles
// (Zone.rect). Code places people inside their zone, keeps them there, and measures distance between two people as a
// straight line when there is sight between their zones (the same zone, or zones joined by sight links), else as the
// walking path through the doorways. A zone with no rectangle (a hand-built test world) is a point: every link costs a
// zone link of metres (linkM), as before positions.
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { doorway } from '../scene/geometry';
import { heightOf } from '../scene/heights';
import { linkM } from '../ruleset/range';
import { allActors, shortestPath, zoneById } from './relations';
import type { GameState, Zone } from '../types';

export type Pos = { x: number; y: number };
/** someone or something that stands somewhere: a zone, and a point in it once the zone has a rectangle */
export type Located = { zone: string; pos?: Pos };

const EPS = 0.01;
const centre = (z: Zone): Pos | undefined => (z.rect ? { x: z.rect.x, y: z.rect.y } : undefined);
const inside = (z: Zone, p: Pos) => !!z.rect && Math.abs(p.x - z.rect.x) <= z.rect.w / 2 + EPS && Math.abs(p.y - z.rect.y) <= z.rect.d / 2 + EPS;
const flat = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y);

/** where it stands: its own point while that lies in its zone, else the zone's centre; no point in a zone without a rectangle */
export function spotOf(state: GameState, a: Located): Located {
  const z = zoneById(state, a.zone);
  if (!z?.rect) return { zone: a.zone };
  return { zone: a.zone, pos: a.pos && inside(z, a.pos) ? a.pos : centre(z) };
}

/** ZP1: gives everyone on stage whose point is missing or outside its zone a free spot in it: the zone's centre, else the
 * nearest point on a PLACE_GAP_M grid around it that keeps PLACE_GAP_M from everyone already standing there */
export function placeAll(state: GameState): void {
  const gap = CONFIG.PLACE_GAP_M;
  const people = allActors(state);
  for (const a of people) {
    const z = zoneById(state, a.zone);
    if (!z?.rect) { delete a.pos; continue; }
    if (a.pos && inside(z, a.pos)) continue;
    const taken = people.filter((o) => o !== a && o.zone === a.zone && o.pos && inside(z, o.pos)).map((o) => o.pos!);
    const c = anchor(state, z);
    let spot = c;
    search: for (let r = 0; r <= 50; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const p = { x: c.x + i * gap, y: c.y + j * gap };
        if (inside(z, p) && taken.every((t) => flat(t, p) >= gap - EPS)) { spot = p; break search; }
      }
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
function route(state: GameState, A: Located, B: Located): { zone: Zone; at?: Pos; out?: Pos }[] | null {
  const path = shortestPath(state, A.zone, B.zone);
  if (!path) return null;
  let prev = zoneById(state, A.zone)!;
  return path.map((id) => {
    const z = zoneById(state, id)!;
    const c = prev.rect && z.rect ? crossing(prev, z) : undefined;
    prev = z;
    return { zone: z, ...(c ? { at: c.at, out: c.out } : {}) };
  });
}

/** metres between two people with sight between their zones (the same zone, or a path of sight links): the straight
 * line; Infinity without sight. What an attack reaches across (a blow or a shot never goes round a wall). */
export function sightDistM(state: GameState, a: Located, b: Located): number {
  const A = spotOf(state, a), B = spotOf(state, b);
  if (A.zone === B.zone) return A.pos && B.pos ? flat(A.pos, B.pos) : 0;
  const p = shortestPath(state, A.zone, B.zone, true);
  if (!p) return Infinity;
  if (!A.pos || !B.pos) return p.length * linkM();
  return Math.hypot(flat(A.pos, B.pos), heightOf(zoneById(state, A.zone)) - heightOf(zoneById(state, B.zone)));
}

/** step 2 PR 2: how far away something is for sight, in metres: sightDistM, never under SAME_ZONE_M (in a zone without a
 * rectangle the same zone is SAME_ZONE_M away and each sight link LINK_PACES × PACE_M); null without sight */
export function seeingM(state: GameState, a: Located, b: Located): number | null {
  const d = sightDistM(state, a, b);
  return d === Infinity ? null : Math.max(d, CONFIG.SAME_ZONE_M);
}

/** ZP4: metres between two people (or a person and a spot): a straight line with sight between their zones, else the
 * walking path through the doorways; Infinity with no way between them */
export function distM(state: GameState, a: Located, b: Located): number {
  const A = spotOf(state, a), B = spotOf(state, b);
  if (A.zone === B.zone) return A.pos && B.pos ? flat(A.pos, B.pos) : 0;
  const seen = sightDistM(state, A, B);
  if (A.pos && B.pos && seen < Infinity) return seen;
  const r = route(state, A, B);
  if (!r) return Infinity;
  if (!A.pos || !B.pos || r.some((s) => !s.at)) return r.length * linkM();
  let m = 0, cur = A.pos, h = heightOf(zoneById(state, A.zone));
  for (const s of r) { m += flat(cur, s.out!) + Math.abs(heightOf(s.zone) - h); cur = s.at!; h = heightOf(s.zone); }
  return m + flat(cur, B.pos);
}

/** ZP2: one leg of a walk toward `goal`: to the doorway of the next zone on the way (entering it), or, inside the goal's
 * zone, straight at the goal's point, stopping `stopShort` metres before it. A goal with no point is the zone itself: the
 * walk ends ENTER_M past its doorway. At most `metres` are walked; a zone without rectangles is crossed whole for a zone
 * link of metres, and `fresh` (a slot not yet used) crosses it even when the slot is shorter. Returns the metres walked
 * (0: nothing left to walk), or null when there is no way. */
export function walkLeg(state: GameState, a: Located & { placeId?: string }, goal: Located, metres: number, stopShort = 0, fresh = false): number | null {
  const A = spotOf(state, a);
  if (A.zone === goal.zone) {
    const B = goal.pos ? spotOf(state, goal) : undefined;
    if (!A.pos || !B?.pos) return 0;
    const d = flat(A.pos, B.pos), go = Math.min(metres, Math.max(0, d - stopShort));
    if (go <= EPS) return 0;
    a.pos = { x: A.pos.x + (B.pos.x - A.pos.x) * go / d, y: A.pos.y + (B.pos.y - A.pos.y) * go / d };
    return go;
  }
  const r = route(state, A, goal);
  if (!r?.length) return null;
  const next = r[0];
  const enter = (at?: Pos) => {
    a.zone = next.zone.id;
    a.placeId = next.zone.placeId;
    if (at) a.pos = { ...at }; else delete a.pos;
  };
  if (!A.pos || !next.at) {
    const cost = linkM();
    if (metres + EPS < cost && !fresh) return 0;
    enter(centre(next.zone));
    return Math.min(metres, cost);
  }
  const from = zoneById(state, A.zone);
  const out = next.out ?? next.at;
  const leg = flat(A.pos, out) + Math.abs(heightOf(next.zone) - heightOf(from));
  if (leg > metres + EPS) {
    if (metres <= EPS) return 0;
    const k = metres / leg;
    a.pos = { x: A.pos.x + (out.x - A.pos.x) * k, y: A.pos.y + (out.y - A.pos.y) * k };
    return metres;
  }
  // through the doorway; a walk to the zone itself goes ENTER_M on toward its centre
  let at = next.at, used = leg;
  if (next.zone.id === goal.zone && !goal.pos) {
    const c = centre(next.zone)!, d = flat(at, c), step = Math.min(CONFIG.ENTER_M, d, metres - leg);
    if (step > EPS) { at = { x: at.x + (c.x - at.x) * step / d, y: at.y + (c.y - at.y) * step / d }; used += step; }
  }
  enter(at);
  return used;
}
