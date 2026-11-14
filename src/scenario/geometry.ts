// Zone geometry (CO1, CO4, CO15, CO16): code, never Claude, gives every zone a rectangle in metres. Its area comes from
// the zone's size; its shape from the kind's aspect (corridors and streets are long); where it sits from the compass words
// of the exits that join it to zones already placed ("the north door" puts it north of the zone it leads from), touching
// that zone's side. Zones up or down stairs sit straight above or below (height never moves a zone across the map).
// Shape is a plain rectangle while CO2 (zone shape) is parked.
import { SIDE_STEP, type GameState, type Rect, type Side, type Zone } from '../types';
import { CONFIG } from '../config';
import { heightOf, verticalOf } from './heights';
import { getLibrary } from '../library';

/** the compass direction an exit's words name, as a unit [east, north], or null when they name none */
export function compassOf(label: string): [number, number] | null {
  let e = 0, n = 0;
  for (const w of label.toLowerCase().split(/[^a-z]+/)) {
    const m = w.match(/^(north|south)?(east|west)?(ward|wards|ern)?$/);
    if (m && (m[1] || m[2])) { if (m[1] === 'north') n += 1; if (m[1] === 'south') n -= 1; if (m[2] === 'east') e += 1; if (m[2] === 'west') e -= 1; }
  }
  if (!e && !n) return null;
  const len = Math.hypot(e, n);
  return [e / len, n / len];
}

/** the point on a rectangle's edge straight out from its centre along `d` (a direction [east, north], any length) */
export function edgeToward(r: Rect, d: [number, number]): { x: number; y: number } {
  const k = Math.min(d[0] ? r.w / 2 / Math.abs(d[0]) : Infinity, d[1] ? r.d / 2 / Math.abs(d[1]) : Infinity);
  return k === Infinity ? { x: r.x, y: r.y } : { x: r.x + d[0] * k, y: r.y + d[1] * k };
}

const sideOf = (d: [number, number]): Side => (Math.abs(d[0]) >= Math.abs(d[1]) ? (d[0] >= 0 ? 'e' : 'w') : d[1] >= 0 ? 'n' : 's');
export const sameFloor = (a: Zone, b: Zone) => Math.abs(heightOf(a) - heightOf(b)) < CONFIG.STOREY_HEIGHT / 2;
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w - 0.01 && Math.abs(a.y - b.y) * 2 < a.d + b.d - 0.01;

/** width (east-west) and depth (north-south) of a zone's rectangle: its area at its aspect, the long side along `axis`,
 *  in whole metres (MAP-10: the map's grid is 1 m, so every zone's sides land on it) */
function dims(z: Zone, axis: 'ew' | 'ns'): [number, number] {
  const area = z.area ?? CONFIG.ZONE_SIZE_M2.room;
  const r = Math.max(1, z.aspect ?? 1);
  // the whole-metre short side (just below or above the true one) whose rectangle comes closest to both the area and the
  // shape: 25 m² at 4 to 1 is 8 × 3
  const exact = Math.sqrt(area / r);
  const fit = [Math.floor(exact), Math.ceil(exact)].filter((x) => x >= 1).map((short) => {
    const long = Math.max(short, Math.round(area / short));
    return { short, long, err: Math.abs(short * long - area) / area + Math.abs(long / short - r) / r };
  }).sort((a, b) => a.err - b.err)[0] ?? { short: 1, long: Math.max(1, Math.round(area)) };
  return axis === 'ew' ? [fit.long, fit.short] : [fit.short, fit.long];
}

/** MAP-10: a rectangle moved so its sides sit on whole metres (its size is whole metres already) */
const snap = (r: Rect): Rect => ({ ...r, x: Math.round(r.x - r.w / 2) + r.w / 2, y: Math.round(r.y - r.d / 2) + r.d / 2 });

/** the box around rectangles (null for none) */
function boxOf(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x - r.w / 2)), x1 = Math.max(...rs.map((r) => r.x + r.w / 2));
  const y0 = Math.min(...rs.map((r) => r.y - r.d / 2)), y1 = Math.max(...rs.map((r) => r.y + r.d / 2));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0 };
}

/** the exit between two zones read from `from`'s side: its compass direction and whether it climbs or drops */
function exitBetween(from: Zone, to: Zone): { dir: [number, number] | null; vertical: number } {
  const out = from.links.find((l) => l.to === to.id), back = to.links.find((l) => l.to === from.id);
  const fwd = out ? compassOf(out.label) : null;
  const rev = back ? compassOf(back.label) : null;
  // heights, once settled (inferHeights runs first and reads the exit from the settled side), decide whether the exit
  // climbs: an exit's words read both ways can disagree ("the low tunnel" one way, "back up into the cellar" the other),
  // and stacking two zones of one height put them on top of each other on the same floor (run 36)
  const settled = from.height !== undefined || to.height !== undefined;
  const vertical = settled ? (sameFloor(from, to) ? 0 : Math.sign(heightOf(to) - heightOf(from)))
    : (out ? verticalOf(out.label) : 0) || (back ? -verticalOf(back.label) : 0);
  return { dir: fwd ?? (rev ? [-rev[0], -rev[1]] : null), vertical };
}

/** how far along a wall placement steps a zone, in whole metres each way, and how many free spots it weighs before it
 *  takes the best so far (a 30 km road has 15 000 metres of side) */
const STEPS_ALONG = 60, SPOTS_TRIED = 80;
/** a story's first zone, or one with no link to anything placed, starts this many metres east of everything */
const START_GAP_M = 20;

/** a place and every place above it, by each place's parent */
function placeChain(state: GameState): (id: string) => Set<string> {
  const parentOf = new Map(state.places.map((p) => [p.id, p.parentId]));
  return (id) => { const out = new Set<string>(); for (let q: string | null | undefined = id, n = 0; q && n < 20; q = parentOf.get(q), n++) out.add(q); return out; };
}

/** WZ1 the point of the region site a place stands on, or the site of a place it sits in */
export function siteOf(state: GameState, placeId: string): { x: number; y: number } | undefined {
  const chain = placeChain(state)(placeId);
  const id = state.places.find((p) => chain.has(p.id) && p.site)?.site;
  return id ? state.regions?.flatMap((r) => r.sites).find((s) => s.id === id)?.at : undefined;
}

/** gives each zone in `zones` without a rectangle one, next to a placed zone it links to (CO1 B). Zones already placed
 *  never move (MAP-03), so a stage that grows only adds zones at its edges. A zone touches a zone it links to, on the
 *  side the exit's compass words name when that side is free, and in whole metres (MAP-10). A building stays one piece
 *  (MAP-12): no zone lands inside another place's footprint (the box around its zones on that floor), and a place never
 *  grows its footprint over a zone that isn't its own, so a street runs beside a tavern and never through it. */
export function placeZones(state: GameState, zones: Zone[]): void {
  const all = state.places.flatMap((p) => p.zones);
  const byId = new Map(all.map((z) => [z.id, z]));
  const parentOf = new Map(state.places.map((p) => [p.id, p.parentId]));
  const chain = placeChain(state);
  const open = new Set(zones.filter((z) => !z.rect).map((z) => z.id));
  const placed = () => all.filter((z) => z.rect);
  /** a building's footprint on z's floor (MAP-12): the box around the indoor zones placed in it or in places inside it;
   *  streets and yards make no footprint, so a lane may wind between houses */
  const footprint = (placeId: string, z: Zone, extra?: Rect) => boxOf([...placed().filter((o) => o !== z && !o.outdoor && sameFloor(o, z) && chain(o.placeId).has(placeId)).map((o) => o.rect!), ...(extra ? [extra] : [])]);
  const free = (z: Zone, r: Rect) => {
    const floor = placed().filter((o) => o !== z && sameFloor(o, z));
    if (floor.some((o) => overlaps(o.rect!, r))) return false;
    const mine = chain(z.placeId);
    // r stays out of every other place's footprint: a place z sits in (its own, or one above it) is no bar
    const others = new Set(floor.flatMap((o) => [...chain(o.placeId)]).filter((pid) => !mine.has(pid)));
    for (const pid of others) { const fp = footprint(pid, z); if (fp && overlaps(fp, r)) return false; }
    // an indoor zone's building (when it sits inside another place) never grows over a zone of somewhere else
    if (!z.outdoor && parentOf.get(z.placeId)) {
      const fp = footprint(z.placeId, z, r)!;
      if (floor.some((o) => !chain(o.placeId).has(z.placeId) && overlaps(o.rect!, fp))) return false;
    }
    return true;
  };
  /** spots touching `p` on `side`: centred, lined up with either end, then every whole-metre step along it */
  const along = (z: Zone, p: Rect, side: Side): Rect[] => {
    const [sx, sy] = SIDE_STEP[side];
    const [w, d] = dims(z, sx ? 'ew' : 'ns');
    const base: Rect = { x: p.x + sx * (p.w + w) / 2, y: p.y + sy * (p.d + d) / 2, w, d };
    const room = sx ? (p.d + d) / 2 - 1 : (p.w + w) / 2 - 1; // still sharing at least 1 m of wall
    const ends = sx ? (p.d - d) / 2 : (p.w - w) / 2;
    const steps = [0, ends, -ends];
    for (let k = 1; k <= Math.min(Math.floor(room), STEPS_ALONG); k++) steps.push(k, -k);
    return steps.filter((t) => Math.abs(t) <= room + 1e-9).map((t) => snap(sx ? { ...base, y: base.y + t } : { ...base, x: base.x + t }));
  };
  for (let pass = 0; open.size && pass < 200; pass++) {
    let progress = false;
    for (const id of [...open]) {
      const z = byId.get(id)!;
      const linked = [...z.links.map((l) => byId.get(l.to)), ...all.filter((o) => o.links.some((l) => l.to === z.id))].filter((o): o is Zone => !!o?.rect);
      const near = linked[0];
      if (!near) continue;
      const p = near.rect!;
      const { dir, vertical } = exitBetween(near, z);
      if (vertical || !sameFloor(near, z)) {
        const [w, d] = dims(z, p.w >= p.d ? 'ew' : 'ns');
        z.rect = snap({ x: p.x, y: p.y, w, d }); // up or down the stairs: straight above or below
      } else {
        // touch a zone it links to: the first one on the side its exit names, then that zone's other sides, then the
        // other zones it links to, then the zones of its own place; the first spot that is free wins (BG-7, MAP-12)
        const own = placed().filter((o) => o.placeId === z.placeId && sameFloor(o, z) && !linked.includes(o));
        const anchors = [...new Set([...linked.filter((o) => sameFloor(o, z)), ...own])];
        const ALL: Side[] = ['e', 's', 'w', 'n'];
        // of the free spots, the first that leaves the most room for the zones z's exits name a side for (the bar
        // "behind the counter, north" needs the common room's north side clear): an indoor one counts double
        const wants = z.links.flatMap((l) => {
          const u = byId.get(l.to), d = compassOf(l.label);
          return u && !u.rect && open.has(u.id) && d && sameFloor(u, z) && !exitBetween(z, u).vertical ? [{ u, side: sideOf(d), w: u.outdoor ? 1 : 2 }] : [];
        });
        const most = wants.reduce((n, x) => n + x.w, 0);
        const room = (c: Rect) => { z.rect = c; const n = wants.reduce((t, x) => t + (along(x.u, c, x.side).some((q) => free(x.u, q)) ? x.w : 0), 0); delete z.rect; return n; };
        let best: Rect | undefined, bestN = -1, tried = 0;
        search: for (const a of anchors) {
          const d0 = a === near ? dir : exitBetween(a, z).dir;
          const sides = d0 ? [sideOf(d0), ...ALL.filter((x) => x !== sideOf(d0))] : ALL;
          for (const side of sides) for (const c of along(z, a.rect!, side)) {
            if (!free(z, c)) continue;
            const n = wants.length ? room(c) : 0;
            if (n > bestN) { best = c; bestN = n; }
            if (n === most || ++tried >= SPOTS_TRIED) break search;
          }
        }
        if (!best) {
          // every touching spot is in the way: slide outward from the first side's centred spot until nothing on this
          // floor is
          const side = dir ? sideOf(dir) : 'e', [sx, sy] = SIDE_STEP[side];
          const r = along(z, p, side)[0];
          for (let k = 0; k < 100 && !free(z, r); k++) { r.x += sx * Math.ceil(r.w / 2); r.y += sy * Math.ceil(r.d / 2); }
          best = snap(r);
        }
        z.rect = best;
      }
      open.delete(id); progress = true;
    }
    if (!progress) {
      // nothing to go by (a story's first zones, or a place with no link to anything placed): on its settlement's site
      // (WZ1), else east of everything
      const z = byId.get([...open][0])!;
      const rs = placed().map((o) => o.rect!);
      const [w, d] = dims(z, 'ew');
      const site = siteOf(state, z.placeId);
      const x = site ? site.x : rs.length ? Math.max(...rs.map((r) => r.x + r.w / 2)) + START_GAP_M + w / 2 : 0;
      z.rect = snap({ x, y: site ? site.y : 0, w, d });
      open.delete(z.id);
    }
  }
}

/** MAP-10/11/12 on stored rectangles: the places whose own zones are off the 1 m grid, partly over another zone on their
 *  floor, or whose building (the box around its indoor zones) has a zone of somewhere else running through it */
export function brokenLayouts(state: GameState): { placeId: string; why: string }[] {
  const all = state.places.flatMap((p) => p.zones).filter((z) => z.rect);
  const chain = placeChain(state);
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  const out = new Map<string, string>();
  const flag = (placeId: string, why: string) => { if (!out.has(placeId)) out.set(placeId, why); };
  for (const z of all) {
    const r = z.rect!;
    if (!(whole(r.w) && whole(r.d) && whole(r.x - r.w / 2) && whole(r.y - r.d / 2))) flag(z.placeId, `MAP-10 ${z.id} is off the 1 m grid`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (sameFloor(a, b) && overlaps(a.rect!, b.rect!)) flag(a.placeId, `MAP-11 ${a.id} and ${b.id} overlap`);
  }
  for (const pl of state.places) for (const z of all.filter((x) => !x.outdoor && chain(x.placeId).has(pl.id))) {
    const fp = boxOf(all.filter((o) => !o.outdoor && sameFloor(o, z) && chain(o.placeId).has(pl.id)).map((o) => o.rect!))!;
    const inner: Rect = { ...fp, w: fp.w - 1, d: fp.d - 1 };
    const through = all.find((o) => sameFloor(o, z) && !chain(o.placeId).has(pl.id) && !chain(pl.id).has(o.placeId) && overlaps(o.rect!, inner))
      ?? all.find((o) => sameFloor(o, z) && o.outdoor && chain(pl.id).has(o.placeId) && o.placeId !== pl.id && overlaps(o.rect!, inner));
    if (through) { flag(pl.id, `MAP-12 ${through.id} runs through ${pl.id}`); break; }
  }
  return [...out].map(([placeId, why]) => ({ placeId, why }));
}

/** MR2: a stored layout that breaks MAP-10, 11 or 12 is placed again, once, place by place (only the broken places' zones
 *  move, so MAP-03 holds for everything else and for these from then on). Everyone and everything standing or lying in a
 *  moved zone keeps its spot in it: the same share of the way across and up. Returns what was re-placed and why. */
export function relayBroken(state: GameState): { placeId: string; why: string }[] {
  const broken = brokenLayouts(state);
  if (!broken.length) return [];
  const ids = new Set(broken.map((b) => b.placeId));
  const zones = state.places.filter((p) => ids.has(p.id)).flatMap((p) => p.zones).filter((z) => z.rect);
  const before = new Map(zones.map((z) => [z.id, { ...z.rect! }]));
  for (const z of zones) delete z.rect;
  placeZones(state, zones);
  const move = (zoneId: string, pt: { x: number; y: number }) => {
    const a = before.get(zoneId), b = zones.find((z) => z.id === zoneId)?.rect;
    if (!a || !b) return;
    const fx = a.w ? (pt.x - a.x) / a.w : 0, fy = a.d ? (pt.y - a.y) / a.d : 0;
    pt.x = b.x + Math.max(-0.5, Math.min(0.5, fx)) * b.w; pt.y = b.y + Math.max(-0.5, Math.min(0.5, fy)) * b.d;
  };
  for (const a of [state.player, ...state.actors]) if (a.pos) move(a.zone, a.pos);
  for (const z of zones) for (const it of z.groundItems ?? []) if (it.at) move(z.id, it.at);
  const j = state.player.journal;
  for (const [who, pt] of Object.entries(j?.lastSpot ?? {})) { const zid = j?.lastKnown?.[who]; if (zid) move(zid, pt); }
  return broken;
}

/** CO3: the doorway between two zones that touch, at the middle of their shared wall; null when they don't share one */
export function doorway(a: Zone, b: Zone): { x: number; y: number } | null {
  if (!a.rect || !b.rect) return null;
  const A = a.rect, B = b.rect;
  const x0 = Math.max(A.x - A.w / 2, B.x - B.w / 2), x1 = Math.min(A.x + A.w / 2, B.x + B.w / 2);
  const y0 = Math.max(A.y - A.d / 2, B.y - B.d / 2), y1 = Math.min(A.y + A.d / 2, B.y + B.d / 2);
  if (x1 < x0 - 0.01 || y1 < y0 - 0.01) return null;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** metres between two zones' centres across the map (height left out) */
export const zoneDistanceM = (a: Zone, b: Zone): number | null => (a.rect && b.rect ? Math.hypot(a.rect.x - b.rect.x, a.rect.y - b.rect.y) : null);

/** HB4: the edge kind id of `a`'s side facing `b`, its zone kind's default edge when the side is unnamed (CO15); null
 *  without rectangles, or with neither */
export function edgeFacing(a: Zone, b: Zone): string | null {
  if (!a.rect || !b.rect) return null;
  return a.edges?.[sideOf([b.rect.x - a.rect.x, b.rect.y - a.rect.y])] ?? (a.kind ? getLibrary().zoneKinds?.[a.kind]?.edge : undefined) ?? null;
}

/** BG-62: whether `a`'s side facing `b` is an edge you reach over but don't walk across (a counter, fence or rail) */
export function reachesOver(a: Zone, b: Zone, edgeKinds: Record<string, { walk: boolean; reach: boolean }>): boolean {
  const k = edgeKinds[edgeFacing(a, b) ?? ''];
  return !!k && k.reach && !k.walk;
}
