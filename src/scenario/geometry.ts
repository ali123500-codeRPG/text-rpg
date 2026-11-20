// Title placement (CO1, CO4, CO15, CO16; PZ14 a): code, never Claude, gives every new title a footprint in metres. Its
// area comes from the title's size; its shape from the kind's aspect (corridors and streets are long); where it sits from
// the compass words of the ways that join it to titles already placed ("the north door" puts it north of the title it
// leads from), touching that title's side. Titles up or down stairs sit straight above or below (a floor never moves a
// title across the map). Templates draw plain rectangles; a footprint may be any shape (PZ1), and a road's is a band along
// its line (PZ9).
import { SIDE_STEP, type GameState, type Rect, type Side, type Zone } from '../types';
import { CONFIG } from '../config';
import { boxOf, rectOutline } from '../plan/geom';
import { buildingCheck, pxBox } from '../plan/footprint';

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
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w - 0.01 && Math.abs(a.y - b.y) * 2 < a.d + b.d - 0.01;

/** width (east-west) and depth (north-south) of a title's footprint: its area at its aspect, the long side along `axis`,
 *  in whole metres (MAP-10: the map's grid is 1 m, so every title's sides land on it) */
function dims(t: PlaceInput, axis: 'ew' | 'ns'): [number, number] {
  const area = t.area;
  const r = Math.max(1, t.aspect);
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

/** how far along a wall placement steps a zone, in whole metres each way, and how many free spots it weighs before it
 *  takes the best so far (a 30 km road has 15 000 metres of side) */
const STEPS_ALONG = 60, SPOTS_TRIED = 80;
/** two footprints share at least 1 m of wall (they touch along a side, not just at a corner) */
const touches = (a: Rect, b: Rect): boolean => {
  const gx = Math.abs(a.x - b.x) - (a.w + b.w) / 2, gy = Math.abs(a.y - b.y) - (a.d + b.d) / 2;
  return (Math.abs(gx) < 1e-6 && gy <= -1 + 1e-6) || (Math.abs(gy) < 1e-6 && gx <= -1 + 1e-6);
};
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

/** a way between two titles as placement reads it: from `a`, its label (compass words), and whether `b` is a floor up (1)
 * or down (−1) */
export type PlaceJoin = { a: string; b: string; label: string; vertical: number };
/** what placement needs of a title it places: its floor area, aspect and whether a roof goes over it (a building) */
export type PlaceInput = { z: Zone; area: number; aspect: number; roof: boolean };

/** gives each title in `todo` a footprint (a rectangle, as its outline), next to a placed title it joins (CO1 B). Titles
 * already placed never move (MAP-03), so a stage that grows only adds titles at its edges. A title touches a title it
 * joins, on the side the way's compass words name when that side is free, and in whole metres (MAP-10). A building stays
 * one piece (MAP-12): no title of somewhere else lands over its rooms or cuts its footprint in two, and a new room never
 * leaves its own building in pieces, so a street runs beside a tavern and never through it, but may fill its notches and
 * courtyards. The footprint is the checker's shape (MAP-13, buildingCheck): the whole ground of the building's roofed
 * titles, seen or not (RM19 b, RM21 a). `roofed` says which placed titles are under a roof. */
export function placeZones(state: GameState, todo: PlaceInput[], joins: PlaceJoin[], roofed: (z: Zone) => boolean): void {
  const all = state.places.flatMap((p) => p.zones);
  const byId = new Map(all.map((z) => [z.id, z]));
  const inputs = new Map(todo.map((t) => [t.z.id, t]));
  const parentOf = new Map(state.places.map((p) => [p.id, p.parentId]));
  const chain = placeChain(state);
  const rects = new Map<string, Rect>();
  // land roads are bands along their lines: they take no part in the boxes placement keeps apart (PZ9)
  for (const z of all) if (z.outline?.length && !z.road && !inputs.has(z.id)) rects.set(z.id, boxOf(z.outline));
  const roof = (z: Zone) => inputs.get(z.id)?.roof ?? roofed(z);
  const sameFloor = (a: Zone, b: Zone) => Math.abs(a.floor - b.floor) < CONFIG.STOREY_HEIGHT / 2;
  const open = new Set(todo.filter((t) => !t.z.outline?.length).map((t) => t.z.id));
  const placed = () => all.filter((z) => rects.has(z.id));
  const R = (z: Zone) => rects.get(z.id)!;
  const joined = (z: Zone) => joins.filter((j) => j.a === z.id || j.b === z.id).map((j) => byId.get(j.a === z.id ? j.b : j.a)).filter((o): o is Zone => !!o);
  /** the way between two titles read from `from`'s side: its compass direction */
  const dirOf = (from: Zone, to: Zone): [number, number] | null => {
    const out = joins.find((j) => j.a === from.id && j.b === to.id), back = joins.find((j) => j.a === to.id && j.b === from.id);
    const fwd = out ? compassOf(out.label) : null, rev = back ? compassOf(back.label) : null;
    return fwd ?? (rev ? [-rev[0], -rev[1]] : null);
  };
  const depth = (pid: string) => chain(pid).size - 1;
  /** MAP-12 on the building `pid` on z's floor, with z at r: what runs through it and how many pieces it is in
   *  (buildingCheck); streets and yards make no footprint, so a lane may wind between houses */
  const building = (pid: string, z: Zone, r: Rect) => {
    const floor = [...placed().filter((o) => o !== z && sameFloor(o, z)).map((o) => ({ o, r: R(o) })), { o: z, r }];
    const inner = floor.filter((x) => roof(x.o) && chain(x.o.placeId).has(pid)).map((x) => pxBox(x.r));
    return inner.length ? buildingCheck(inner, floor.filter((x) => !chain(x.o.placeId).has(pid)).map((x) => ({ id: x.o.id, b: pxBox(x.r) })), depth(pid)) : undefined;
  };
  const free = (z: Zone, r: Rect) => {
    const floor = placed().filter((o) => o !== z && sameFloor(o, z));
    if (floor.some((o) => overlaps(R(o), r))) return false;
    const mine = chain(z.placeId);
    const others = new Set(floor.flatMap((o) => [...chain(o.placeId)]).filter((pid) => !mine.has(pid)));
    for (const pid of others) if (building(pid, z, r)?.through.has(z.id)) return false;
    if (roof(z) && parentOf.get(z.placeId)) {
      const own = building(z.placeId, z, r)!;
      if (own.through.size || own.pieces > 1) return false;
    }
    return true;
  };
  const along = (z: Zone, p: Rect, side: Side): Rect[] => {
    const [sx, sy] = SIDE_STEP[side];
    const [w, d] = dims(inputs.get(z.id)!, sx ? 'ew' : 'ns');
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
      const linked = joined(z).filter((o) => rects.has(o.id));
      const near = linked[0];
      if (!near) continue;
      const p = R(near);
      const dir = dirOf(near, z);
      let best: Rect | undefined;
      if (!sameFloor(near, z)) {
        const [w, d] = dims(inputs.get(z.id)!, p.w >= p.d ? 'ew' : 'ns');
        best = snap({ x: p.x, y: p.y, w, d }); // up or down the stairs: straight above or below
      } else {
        // touch a title it joins: the first one on the side its way names, then that title's other sides, then the other
        // titles it joins, then the titles of its own place; the first spot that is free wins (BG-7, MAP-12)
        const own = placed().filter((o) => o.placeId === z.placeId && sameFloor(o, z) && !linked.includes(o));
        const anchors = [...new Set([...linked.filter((o) => sameFloor(o, z)), ...own])];
        const ALL: Side[] = ['e', 's', 'w', 'n'];
        // of the free spots, the first that leaves the most room for the titles z's ways name a side for (the bar
        // "behind the counter, north" needs the common room's north side clear): a roofed one counts double
        const wants = joins.filter((j) => j.a === z.id).flatMap((j) => {
          const u = byId.get(j.b), d = compassOf(j.label);
          return u && open.has(u.id) && d && sameFloor(u, z) && !j.vertical ? [{ u, side: sideOf(d), w: roof(u) ? 2 : 1 }] : [];
        });
        const most = wants.reduce((n, x) => n + x.w, 0);
        // a side is clear when no title of somewhere else lies along it: a lane may fill a building's notch (RM19 b), but
        // not the side the counter's way names
        const clear = (c: Rect, side: Side) => {
          const [sx, sy] = SIDE_STEP[side];
          // how far o's near side stands out from c's side `side` (0: on it)
          const gap = (o: Rect) => (sx ? sx * (o.x - c.x) - (c.w + o.w) / 2 : sy * (o.y - c.y) - (c.d + o.d) / 2);
          return !placed().some((o) => sameFloor(o, z) && !chain(o.placeId).has(z.placeId) && touches(c, R(o)) && Math.abs(gap(R(o))) < 1e-6);
        };
        const room = (c: Rect) => { rects.set(z.id, c); const n = wants.reduce((t, x) => t + (clear(c, x.side) && along(x.u, c, x.side).some((q) => free(x.u, q)) ? x.w : 0), 0); rects.delete(z.id); return n; };
        // a spot that touches more of the placed titles it joins wins first (a yard between the lane and the back yard
        // touches both, so neither way needs a long connector); then the room it leaves
        const mates = linked.filter((o) => sameFloor(o, z));
        const touching = (c: Rect) => mates.filter((o) => touches(c, R(o))).length;
        let bestN = -1, tried = 0;
        search: for (const a of anchors) {
          const d0 = a === near ? dir : dirOf(a, z);
          const sides = d0 ? [sideOf(d0), ...ALL.filter((x) => x !== sideOf(d0))] : ALL;
          for (const side of sides) for (const c of along(z, R(a), side)) {
            if (!free(z, c)) continue;
            const t = touching(c), n = (wants.length ? room(c) : 0) + t * (most + 1);
            if (n > bestN) { best = c; bestN = n; }
            if ((t === mates.length && n - t * (most + 1) === most) || ++tried >= SPOTS_TRIED) break search;
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
      }
      rects.set(z.id, best);
      z.outline = rectOutline(best);
      open.delete(id); progress = true;
    }
    if (!progress) {
      // nothing to go by (a story's first titles, or a place joined to nothing placed): on its settlement's site (WZ1),
      // else east of everything
      const z = byId.get([...open][0])!;
      const rs = placed().map(R);
      const [w, d] = dims(inputs.get(z.id)!, 'ew');
      const site = siteOf(state, z.placeId);
      const x = site ? site.x : rs.length ? Math.max(...rs.map((r) => r.x + r.w / 2)) + START_GAP_M + w / 2 : 0;
      const r = snap({ x, y: site ? site.y : 0, w, d });
      rects.set(z.id, r);
      z.outline = rectOutline(r);
      open.delete(z.id);
    }
  }
}

/** MAP-10/11/12 on placed footprints: the places whose own rectangular titles are off the 1 m grid, partly over another
 *  title on their floor, or whose building (the checker's shape of its roofed titles, buildingCheck) has a title of
 *  somewhere else running through it. Land roads (bands along their lines) take no part. */
export function brokenLayouts(state: GameState, roofed: (z: Zone) => boolean): { placeId: string; why: string }[] {
  const all = state.places.flatMap((p) => p.zones).filter((z) => z.outline?.length && !z.road);
  const box = new Map(all.map((z) => [z.id, boxOf(z.outline)]));
  const B = (z: Zone) => box.get(z.id)!;
  const sameFloor = (a: Zone, b: Zone) => Math.abs(a.floor - b.floor) < CONFIG.STOREY_HEIGHT / 2;
  const chain = placeChain(state);
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
  const out = new Map<string, string>();
  const flag = (placeId: string, why: string) => { if (!out.has(placeId)) out.set(placeId, why); };
  for (const z of all) {
    const r = B(z);
    if (!(whole(r.w) && whole(r.d) && whole(r.x - r.w / 2) && whole(r.y - r.d / 2))) flag(z.placeId, `MAP-10 ${z.id} is off the 1 m grid`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (sameFloor(a, b) && overlaps(B(a), B(b))) flag(a.placeId, `MAP-11 ${a.id} and ${b.id} overlap`);
  }
  for (const pl of state.places) for (const z of all.filter((x) => roofed(x) && chain(x.placeId).has(pl.id))) {
    const floor = all.filter((o) => sameFloor(o, z));
    if (floor.some((o) => o !== z && roofed(o) && chain(o.placeId).has(pl.id) && all.indexOf(o) < all.indexOf(z))) continue; // this floor read already
    const { through } = buildingCheck(floor.filter((o) => roofed(o) && chain(o.placeId).has(pl.id)).map((o) => pxBox(B(o))),
      floor.filter((o) => !chain(o.placeId).has(pl.id)).map((o) => ({ id: o.id, b: pxBox(B(o)) })), chain(pl.id).size - 1);
    if (through.size) { flag(pl.id, `MAP-12 ${[...through][0]} runs through ${pl.id}`); break; }
  }
  return [...out].map(([placeId, why]) => ({ placeId, why }));
}
