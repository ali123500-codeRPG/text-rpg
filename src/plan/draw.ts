// PZ14 a: drawing. The Weaver, a layout or a test names titles with a kind and a size and the ways between them; code,
// never Claude, draws them: each title's floor (from up and down ways), its footprint (placeZones), one wall along each side
// by its wall kind, one opening per way, a roof over a roofed title, its lights (PZ5) and its furniture at points.
// addTitles makes the titles and their openings (an opening to a title not yet drawn waits for it); drawPlan draws them.
// drawTitles does both.
import type { Furniture, GameState, Light, LightSource, Opening, PlanFurniture, Pt, Side, TitleSpec, WayKind, WaySpec, Zone } from '../types';
import { GRADES } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { BK, FU, LS, OP, WK } from '../library/tableIds';
import { LIGHT } from '../scales';
import { compassOf, placeZones, type PlaceInput, type PlaceJoin } from '../scenario/geometry';
import { areaOf, bandOutline, boxOf, dist, lerp, middleOf, nearestEdge, NEAR_M, outward, rectOutline, sharedSides, sidesOf } from './geom';
import { roofed, topFor, inTitle } from './where';
import { paintWall, wallAt } from './walls';
import { planChanged } from './stamp';
import { freshId } from '../ids';

/** what drawing keeps of a title until it is drawn: its spec, and the ways read from it */
type Draft = { titles: Zone[]; specs: Map<string, TitleSpec> };
/** openings made before their titles were drawn, with how their way climbs from joins[0] (1 up, −1 down) */
const pendingClimb = new WeakMap<Opening, number>();
/** the openings still to be placed (a title they join is not drawn yet) */
const unplaced = new WeakSet<Opening>();

const kindDef = (k?: string) => (k ? getLibrary().zoneKinds?.[k] : undefined);
/** the title's spec field, else its kind's */
const roofOf = (sp: TitleSpec | undefined, z: Zone) => sp?.roof ?? kindDef(z.kind)?.roof ?? false;

/** an opening's id: `<place>.o`, else `<place>.o_2` … the first one free (ids.freshId) */
const openingId = (state: GameState, placeId: string) => freshId(`${placeId}.o`, new Set(state.openings.map((o) => o.id)));

/** PZ2: the opening kind of a way kind */
const OPENING_OF: Record<WayKind, string> = { open: OP.gap, door: OP.doorway, window: OP.window, up: OP.stairs, down: OP.stairs };
/** PZ14 a: the kinds of way a plan names (open, door, window, up, down), one per opening kind it draws */
export const WAY_KINDS = Object.keys(OPENING_OF) as WayKind[];
/** the way kind of an opening read from joins[0] */
export function wayKindOf(o: Opening): WayKind {
  if (o.kind === OP.stairs) return (o.to?.floor ?? o.floor) >= o.floor ? 'up' : 'down';
  return o.kind === OP.window ? 'window' : o.kind === OP.gap ? 'open' : 'door';
}

/** PZ14 a: makes titles from specs (each joins its place and the stage) and the openings of their ways; an opening to a
 * title not drawn yet waits for drawPlan. A way to a title that already has a way to it keeps the one there (WI5 a). */
export function addTitles(state: GameState, specs: TitleSpec[]): Draft {
  const draft: Draft = { titles: [], specs: new Map() };
  for (const sp of specs) {
    const { outline, rect, floor, top, roof: _r, walls: _w, light: _l, aspect: _a, ways: _ways, furniture: _f, line, ...rest } = sp;
    const z: Zone = { ...rest, outline: outline ?? (rect ? rectOutline(rect) : []), floor: floor ?? NaN, top: top ?? NaN, ...(line ? { line } : {}) };
    if (!z.outline.length && line) z.outline = bandOutline(line, CONFIG.ROAD_WIDTH_M);
    if (z.area === undefined && z.outline.length) z.area = areaOf(z.outline);
    draft.titles.push(z);
    draft.specs.set(z.id, sp);
    const place = state.places.find((p) => p.id === z.placeId);
    if (place && !place.zones.includes(z)) place.zones.push(z);
    if (!state.zones.includes(z)) state.zones.push(z);
  }
  const byId = (id: string) => state.zones.find((z) => z.id === id);
  for (const sp of specs) for (const w of sp.ways) {
    const from = byId(sp.id)!;
    if (w.frontier) { addFrontier(state, from, w.to, w.label, w); continue; }
    const to = byId(w.to);
    if (!to || to === from) continue;
    const there = state.openings.find((o) => (o.joins[0] === from.id && o.joins[1] === to.id) || (o.joins[1] === from.id && o.joins[0] === to.id && !o.frontier));
    if (there) { // the way back names its label from this side
      const i = there.joins[0] === from.id ? 0 : 1;
      if (!there.labels[i]) there.labels[i] = w.label;
      continue;
    }
    const back = draft.specs.get(to.id)?.ways.find((x) => x.to === from.id && !x.frontier);
    makeOpening(state, from, to, back?.doorless ? { ...w, doorless: true } : w, back?.label ?? w.back);
  }
  return draft;
}

/** an opening between two titles for way `w` from `from` (its kind and size from the way and its barrier); it is placed now
 * when both titles are drawn, else by drawPlan. BG-312: a doorway holds a plain door, shut and unlocked, unless the way
 * gives another barrier or is doorless */
function makeOpening(state: GameState, from: Zone, to: Zone, w: WaySpec, back?: string): Opening {
  const kind = w.kind ?? 'open';
  const def = getLibrary().openingKinds?.[OPENING_OF[kind]];
  const o: Opening = {
    id: openingId(state, from.placeId), placeId: from.placeId, kind: OPENING_OF[kind], at: { x: NaN, y: NaN }, floor: NaN,
    widthM: def?.sizeM?.[0] ?? 0, heightM: def?.sizeM?.[1] ?? 0, ...(def?.sillM !== undefined ? { sillM: def.sillM } : {}),
    joins: [from.id, to.id], labels: [w.label, back ?? from.name],
    ...(kind === 'window' ? { drop: true as const } : {}), ...(w.barrier ? { barrier: w.barrier } : kind === 'door' && !w.doorless ? { barrier: plainDoor(state, from, to) } : {}),
  };
  pendingClimb.set(o, kind === 'up' ? 1 : kind === 'down' ? -1 : 0);
  state.openings.push(o);
  if (o.barrier) fitBarrier(state, o);
  if (from.outline.length && to.outline.length && Number.isFinite(from.floor) && Number.isFinite(to.floor)) placeOpening(state, o);
  else unplaced.add(o);
  return o;
}

/** BG-312: a plain wooden door for a doorway between two titles: shut, unlocked, no scenario's (BA8 counts only the Weaver's) */
function plainDoor(state: GameState, from: Zone, to: Zone): string {
  const id = freshId(`door_${from.id}_${to.id}`, new Set(Object.keys(state.barriers ?? {})));
  (state.barriers ??= {})[id] = { id, kind: BK.door, grade: 'minor' };
  return id;
}

/** WI5 a: the one way to join two drawn titles: an opening between them unless one is there already (kept as it is) */
export function joinWay(state: GameState, a: Zone, b: Zone, opts: { label?: string; back?: string; kind?: WayKind } = {}): Opening | undefined {
  if (a === b) return undefined;
  const there = state.openings.find((o) => !o.frontier && ((o.joins[0] === a.id && o.joins[1] === b.id) || (o.joins[0] === b.id && o.joins[1] === a.id)));
  if (there) return there;
  return makeOpening(state, a, b, { to: b.id, label: opts.label ?? b.name, kind: opts.kind ?? (roofed(state, a) || roofed(state, b) ? 'door' : 'open') }, opts.back ?? a.name);
}

/** a frontier: a way out of `from` to ground not built yet (`key`), on the side its label's compass names (else a side
 * no other title touches) */
export function addFrontier(state: GameState, from: Zone, key: string, label: string, w: Partial<WaySpec> = {}): Opening {
  const there = state.openings.find((o) => o.frontier && o.joins[0] === from.id && o.joins[1] === key);
  if (there) return there;
  const kind = w.kind ?? (from.outline.length && kindDef(from.kind)?.roof ? 'door' : 'open');
  const def = getLibrary().openingKinds?.[OPENING_OF[kind]];
  const o: Opening = {
    id: openingId(state, from.placeId), placeId: from.placeId, kind: OPENING_OF[kind === 'up' || kind === 'down' || kind === 'window' ? 'door' : kind], at: { x: NaN, y: NaN }, floor: NaN,
    widthM: def?.sizeM?.[0] ?? CONFIG.DOORWAY_M[0], heightM: def?.sizeM?.[1] ?? CONFIG.DOORWAY_M[1],
    joins: [from.id, key], labels: [label, ''], frontier: true,
  };
  state.openings.push(o);
  if (from.outline.length && Number.isFinite(from.floor)) placeFrontier(state, o, from);
  else unplaced.add(o);
  return o;
}

/** the point of a title's edge its way to the frontier leaves by: the middle of the side the label's compass names (a
 * road: its end that way), else of a side no other title touches */
export function frontierSpot(state: GameState, from: Zone, label: string): Pt {
  const d = compassOf(label), m = middleOf(from.outline);
  if (from.line?.length) { // PZ9: a road's frontier is the end of its line the compass names, else its far end
    const ends = [from.line[0], from.line[from.line.length - 1]];
    if (d) return ends.sort((p, q) => ((q.x - m.x) * d[0] + (q.y - m.y) * d[1]) - ((p.x - m.x) * d[0] + (p.y - m.y) * d[1]))[0];
    return ends[1];
  }
  const sides = sidesOf(from.outline).map(([a, b]) => ({ mid: lerp(a, b, 0.5), n: outward(a, b) }));
  if (d) return sides.sort((p, q) => (q.n[0] * d[0] + q.n[1] * d[1]) - (p.n[0] * d[0] + p.n[1] * d[1]))[0].mid;
  const touched = (p: Pt) => state.zones.some((z) => z !== from && Math.abs(z.floor - from.floor) < 0.01 && z.outline.length && inTitle(z, p, 0.05));
  return (sides.find((x) => !touched(x.mid)) ?? sides[0]).mid;
}
function placeFrontier(state: GameState, o: Opening, from: Zone): void {
  planChanged();
  o.at = frontierSpot(state, from, o.labels[0]);
  o.floor = from.floor;
  const w = wallAt(state, o.at, o.floor);
  if (w) o.wall = w.id; else delete o.wall;
  unplaced.delete(o);
}

/** a frontier way to `key` is built: each opening to it now joins `to` (or goes, where its title already has a way to
 * `to`), placed once `to` is drawn. NW2: anyone heading for it now heads for the title. */
export function joinFrontier(state: GameState, key: string, to: Zone): void {
  for (const o of state.openings.filter((x) => x.frontier && x.joins[1] === key)) frontierTo(state, o, to);
  for (const a of state.actors) if (a.mind?.slots?.dest === key) a.mind.slots.dest = to.id;
}
/** one frontier opening is built: it now joins `to` (or goes, where its title already has a way to `to`) */
export function frontierTo(state: GameState, o: Opening, to: Zone): void {
  const from = state.zones.find((z) => z.id === o.joins[0]);
  const dup = from && from !== to ? state.openings.find((x) => x !== o && !x.frontier && x.joins.includes(from.id) && x.joins.includes(to.id)) : undefined;
  if (!from || from === to || dup) {
    if (dup && o.labels[0]) dup.labels[dup.joins[0] === from!.id ? 0 : 1] = o.labels[0]; // the way keeps the words it was known by
    state.openings.splice(state.openings.indexOf(o), 1); planChanged(); return;
  }
  o.joins = [o.joins[0], to.id];
  o.labels = [o.labels[0], o.labels[1] || from!.name];
  delete o.frontier;
  pendingClimb.set(o, 0);
  if (to.outline.length && Number.isFinite(to.floor)) placeOpening(state, o); else unplaced.add(o);
}

/** PZ7: floors from the ways: a title up a way of kind up from a title on a known floor stands a storey above it, down a
 * storey below, else level. Titles nothing on a known floor reaches (a story's first titles) settle from one another,
 * then stand so that the lowest of them in the open is on the ground outside (0); with none in the open, the first
 * listed stands at 0 */
function settleFloors(state: GameState, titles: Zone[], open: (z: Zone) => boolean): void {
  const todo = new Set(titles.filter((z) => !Number.isFinite(z.floor)).map((z) => z.id));
  const byId = (id: string) => state.zones.find((z) => z.id === id);
  const group = new Map<Zone, number>(); // titles settled from a guessed 0, not a known floor, by the title guessed
  for (let pass = 0; todo.size && pass < 100; pass++) {
    let moved = false;
    for (const o of state.openings) {
      if (o.frontier) continue;
      const a = byId(o.joins[0]), b = byId(o.joins[1]);
      if (!a || !b) continue;
      const climb = pendingClimb.get(o) ?? (o.to ? Math.sign(o.to.floor - o.floor) : 0);
      if (todo.has(b.id) && Number.isFinite(a.floor)) { b.floor = a.floor + climb * CONFIG.STOREY_HEIGHT; todo.delete(b.id); moved = true; if (group.has(a)) group.set(b, group.get(a)!); }
      else if (todo.has(a.id) && Number.isFinite(b.floor)) { a.floor = b.floor - climb * CONFIG.STOREY_HEIGHT; todo.delete(a.id); moved = true; if (group.has(b)) group.set(a, group.get(b)!); }
    }
    if (!moved) { const z = byId([...todo][0])!; z.floor = 0; todo.delete(z.id); group.set(z, group.size); }
  }
  for (const g of new Set(group.values())) {
    const zs = [...group].filter(([, n]) => n === g).map(([z]) => z);
    const ground = Math.min(...zs.filter(open).map((z) => z.floor));
    if (Number.isFinite(ground)) for (const z of zs) z.floor -= ground;
  }
}

/** PZ14 a: draws the draft's titles: floors, footprints (placeZones), then walls, openings, roofs, lights and furniture */
export function drawPlan(state: GameState, draft: Draft): Zone[] {
  const { titles, specs } = draft;
  settleFloors(state, titles, (z) => !roofOf(specs.get(z.id), z));
  for (const z of titles) if (!Number.isFinite(z.top)) z.top = topFor(z.floor, roofOf(specs.get(z.id), z));
  // footprints: titles with none are placed next to the titles they join
  const todo: PlaceInput[] = titles.filter((z) => !z.outline.length).map((z) => {
    const sp = specs.get(z.id), k = kindDef(z.kind);
    return { z, area: z.area ?? CONFIG.ZONE_SIZE_M2[k?.size ?? 'room'], aspect: sp?.aspect ?? k?.aspect ?? 1, roof: roofOf(sp, z) };
  });
  const joins: PlaceJoin[] = state.openings.filter((o) => !o.frontier).flatMap((o) => {
    const c = pendingClimb.get(o) ?? 0;
    return [{ a: o.joins[0], b: o.joins[1], label: o.labels[0], vertical: c }, { a: o.joins[1], b: o.joins[0], label: o.labels[1], vertical: -c }];
  });
  placeZones(state, todo, joins, (z) => roofed(state, z));
  for (const t of todo) {
    if (t.z.area === undefined) t.z.area = t.area;
    // TV3: a road with no land line under it runs along its footprint's long axis
    if (specs.get(t.z.id)?.line === undefined && t.z.danger && !t.z.road) { const b = boxOf(t.z.outline); t.z.line = b.w >= b.d ? [{ x: b.x - b.w / 2, y: b.y }, { x: b.x + b.w / 2, y: b.y }] : [{ x: b.x, y: b.y - b.d / 2 }, { x: b.x, y: b.y + b.d / 2 }]; }
  }
  for (const z of titles) drawWalls(state, z, specs.get(z.id));
  for (const o of state.openings.filter((x) => unplaced.has(x))) {
    if (o.frontier) { const from = state.zones.find((z) => z.id === o.joins[0]); if (from?.outline.length) placeFrontier(state, o, from); }
    else placeOpening(state, o);
  }
  for (const z of titles) {
    const sp = specs.get(z.id);
    if (roofOf(sp, z) && !z.line) state.roofs.push({ id: `${z.id}.roof`, placeId: z.placeId, outline: z.outline, h: z.top });
    drawLights(state, z, sp, roofOf(sp, z));
    const furn = sp?.furniture ?? kindDef(z.kind)?.furniture;
    if (furn?.length) state.furniture.push(...makeFurniture(state, z, furn));
  }
  return titles;
}

/** addTitles then drawPlan */
export const drawTitles = (state: GameState, specs: TitleSpec[]): Zone[] => drawPlan(state, addTitles(state, specs));

/** a side's compass letter by its outward direction */
const sideLetter = (n: [number, number]): Side => (Math.abs(n[0]) >= Math.abs(n[1]) ? (n[0] >= 0 ? 'e' : 'w') : n[1] >= 0 ? 'n' : 's');
/** PZ2: one wall along each side of a title by its wall kind (the spec's for that side, else its kind's: a wall under a
 * roof, none in the open); roads have none */
function drawWalls(state: GameState, z: Zone, sp?: TitleSpec): void {
  if (z.line?.length || !z.outline.length) return;
  const def = sp?.roof ?? kindDef(z.kind)?.roof ? WK.wall : WK.open;
  const base = kindDef(z.kind)?.wall ?? def;
  for (const [a, b] of sidesOf(z.outline)) {
    const kind = sp?.walls?.[sideLetter(outward(a, b))] ?? (sp?.roof === undefined ? base : def);
    paintWall(state, z.placeId, a, b, z.floor, z.top, kind);
  }
}

/** SZ7, PC3: an opening takes its size (and a window its sill) from its barrier kind when it has one */
export function fitBarrier(state: GameState, o: Opening): void {
  const b = o.barrier ? state.barriers?.[o.barrier] : undefined;
  const k = b ? getLibrary().barrierKinds?.[b.kind] : undefined;
  if (k?.openingM) { o.widthM = k.openingM[0]; o.heightM = k.openingM[1]; }
  if (k?.sillM !== undefined) o.sillM = k.sillM;
  if (k?.window && o.kind !== OP.window) { o.kind = OP.window; o.drop = true; }
}

/** PZ2: places an opening between its two drawn titles: a way on one floor at the middle of the longest side they share
 * (CO3, a doorway), cut in the wall there; stairs at the middle of where their footprints overlap, reaching the other
 * floor; titles that do not touch get a passage from the edge of one to the edge of the other (`to`). A gap between two
 * titles with no wall between them is as wide as the ground they share; across a wall, ARCH_M. */
export function placeOpening(state: GameState, o: Opening): void {
  planChanged();
  const A = state.zones.find((z) => z.id === o.joins[0]), B = state.zones.find((z) => z.id === o.joins[1]);
  if (!A?.outline.length || !B?.outline.length || !Number.isFinite(A.floor) || !Number.isFinite(B.floor)) return;
  unplaced.delete(o);
  const climb = pendingClimb.get(o) ?? 0;
  pendingClimb.delete(o);
  const level = Math.abs(A.floor - B.floor) < CONFIG.STOREY_HEIGHT / 2;
  if (!level && o.kind !== OP.window) { // stairs, a ladder, a hatch: where the two footprints overlap
    o.kind = OP.stairs;
    const ov = overlapMiddle(A.outline, B.outline) ?? nearestEdge(middleOf(B.outline), A.outline).at;
    o.at = ov; o.floor = A.floor; o.to = { x: ov.x, y: ov.y, floor: B.floor };
    delete o.wall;
    return;
  }
  void climb;
  const shared = sharedSides(A.outline, B.outline).sort((p, q) => dist(q[0], q[1]) - dist(p[0], p[1]))[0];
  if (o.kind === OP.window) { // a window or ledge from A over the lower ground B (a drop)
    const at = shared ? lerp(shared[0], shared[1], 0.5) : nearestEdge(middleOf(B.outline), A.outline).at;
    o.at = at; o.floor = A.floor;
    const into = middleOf(B.outline), d = dist(at, into) || 1, k = Math.min(0.5, d) / d;
    o.to = { x: at.x + (into.x - at.x) * k, y: at.y + (into.y - at.y) * k, floor: B.floor };
    const w = wallAt(state, at, A.floor);
    if (w) o.wall = w.id; else delete o.wall;
    return;
  }
  if (shared) {
    o.at = lerp(shared[0], shared[1], 0.5); o.floor = A.floor; delete o.to;
    const w = wallAt(state, o.at, A.floor);
    if (w) o.wall = w.id; else delete o.wall;
    if (o.kind === OP.gap) {
      if (!w) { o.widthM = dist(shared[0], shared[1]); o.heightM = Math.min(A.top, B.top) - A.floor; }
      else { o.widthM = Math.min(CONFIG.ARCH_M, dist(shared[0], shared[1])); o.heightM = Math.min(w.top - w.floor, CONFIG.DOORWAY_M[1]); }
    }
    if (o.kind === OP.doorway && !o.barrier && !w) { o.widthM = Math.max(o.widthM, CONFIG.DOORWAY_M[0]); }
    return;
  }
  // BG-7: they do not touch: a passage from A's edge nearest B to B's edge nearest that
  const out = nearestEdge(middleOf(B.outline), A.outline).at, into = nearestEdge(out, B.outline).at;
  o.at = out; o.floor = A.floor; o.to = { x: into.x, y: into.y, floor: B.floor };
  const w = wallAt(state, out, A.floor);
  if (w) o.wall = w.id; else delete o.wall;
  if (o.kind === OP.gap && !w) { o.widthM = Math.max(o.widthM, CONFIG.ARCH_M); o.heightM = Math.max(o.heightM, CONFIG.DOORWAY_M[1]); }
}

/** the middle of where two outlines overlap (as boxes), or null */
function overlapMiddle(A: Pt[], B: Pt[]): Pt | null {
  const a = boxOf(A), b = boxOf(B);
  const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
  const y0 = Math.max(a.y - a.d / 2, b.y - b.d / 2), y1 = Math.min(a.y + a.d / 2, b.y + b.d / 2);
  if (x1 < x0 - NEAR_M || y1 < y0 - NEAR_M) return null;
  const p = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  return inTitle({ outline: A } as Zone, p) ? p : middleOf(A);
}

/** PZ5 a: a title's light word as a source: the title's lights at its middle, under its ceiling (a lamp post's height in
 * the open), bright enough that the word holds out to its far corner (lux = candela ÷ metres²); none for pitch black, and
 * none in the open for a word no brighter than moonlit (the sky's own at night) */
function drawLights(state: GameState, z: Zone, sp: TitleSpec | undefined, roof: boolean): void {
  const word = sp?.light ?? kindDef(z.kind)?.light ?? 'bright';
  const lux = CONFIG.LIGHT_LUX[word] ?? 0;
  if (lux <= 0 || (!roof && LIGHT.pos(word) >= LIGHT.pos('moonlit')) || !z.outline.length) return;
  const at = z.line?.length ? z.line[Math.floor(z.line.length / 2)] : middleOf(z.outline);
  const h = roof ? z.top - CONFIG.LIGHT_BELOW_TOP_M : z.floor + CONFIG.LIGHT_POST_M;
  const far = Math.max(...z.outline.map((p) => Math.hypot(dist(p, at), h - z.floor)));
  const src: LightSource = { id: `${z.id}.light`, placeId: z.placeId, kind: LS.lights, at, h, candela: lux * far * far * 1.0001 };
  state.lights.push(src);
}

/** PZ5 a: a title's lights are drawn anew for a light word (its old ones taken down first) */
export function setTitleLight(state: GameState, z: Zone, word: Light): void {
  state.lights = state.lights.filter((l) => l.id !== `${z.id}.light`);
  drawLights(state, z, { light: word } as TitleSpec, roofed(state, z));
}

const WORDS: Record<string, string> = { n: 'north', ne: 'north east', e: 'east', se: 'south east', s: 'south', sw: 'south west', w: 'west', nw: 'north west' };
/** how far in from the wall a piece on a side stands, in metres */
const INSET_M = 0.5;
/** FR2: a title's furniture from a list (unknown kinds count as "other"), with ids `${title}.fu${n}`, each at a point: on
 * its side or corner INSET_M in from the edge (an edge piece, a counter, on the edge itself), else at the middle */
export function makeFurniture(state: GameState, z: Zone, list: PlanFurniture[]): Furniture[] {
  return list.filter((x) => x?.name).map((x, i) => {
    const side = x.at && (WORDS[x.at.toLowerCase()] || compassOf(x.at)) ? x.at.toLowerCase() : undefined;
    return {
      id: `${z.id}.fu${i + 1}`, kind: getLibrary().furnitureKinds?.[x.kind] ? x.kind : FU.other, name: x.name, placeId: z.placeId, zone: z.id,
      pos: furnitureSpot(z, side, !!(x.edge && side)), floor: z.floor,
      ...(side ? { side } : {}), ...(x.edge && side ? { edge: true as const } : {}),
      ...(x.grade && GRADES.includes(x.grade) ? { grade: x.grade } : {}),
    };
  });
}
/** where a piece by `side` stands in a title: INSET_M in from the edge that way (on the edge for an edge piece) */
export function furnitureSpot(z: Zone, side: string | undefined, edge: boolean): Pt {
  const m = middleOf(z.outline);
  const d = side ? compassOf(WORDS[side] ?? side) : null;
  if (!d) return m;
  const b = boxOf(z.outline);
  const k = Math.min(d[0] ? b.w / 2 / Math.abs(d[0]) : Infinity, d[1] ? b.d / 2 / Math.abs(d[1]) : Infinity);
  const p = k === Infinity ? m : { x: b.x + d[0] * k, y: b.y + d[1] * k };
  const dx = m.x - p.x, dy = m.y - p.y, len = Math.hypot(dx, dy), inset = edge ? 0 : Math.min(INSET_M, len);
  return len ? { x: p.x + (dx / len) * inset, y: p.y + (dy / len) * inset } : p;
}
