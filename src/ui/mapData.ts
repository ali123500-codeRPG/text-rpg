// The Map page's data: only what the character knows. Zones it stood in or saw across a sight link (journal.zonesSeen),
// the squares of them it has seen (the fog, PZ12 a), each way's doorway where it stands (BG-313),
// what it sees now (PlayerView), its trail, and the places the Journal lists. Never the hidden store: light, cover and
// things on the ground show only for zones in view now; a remembered zone keeps its name, look and exits. People are a
// list of their own, each at their point (MAP-68).
import { furnitureIn, furniturePos } from '../engine/furniture';
import type { GameState, SeenActor } from '../types';
import { buildPlayerView, instanceItem } from '../views';
import { iconName, kindIconName } from './itemIcons';
import type { IconName } from './iconArt';
import { seesAcross, zoneById } from '../engine/relations';
import { knownZoneIds } from '../engine/trail';
import { journalPlaces } from './pages';
import { heightOf } from '../scenario/heights';
import { WK } from '../library/tableIds';
import { roofed, waysOut } from '../plan/where';
import { NEAR_M, areaOf, boxOf, dist, inOutline, lerp, sidesOf, toSegment } from '../plan/geom';
import { seenRuns, type SeenRun } from '../plan/fog';
import { OP } from '../library/tableIds';
import { barrierOn, barrierView } from '../engine/barriers';
import { landSeen } from '../land/sight';
import { plural } from './kit';
import { actorBody, itemDef } from '../library';
import { CONFIG } from '../config';
import { LIFE_STAGES } from '../scales';

/** a barrier on an exit as the character knows it: what it is, and whether it stops them (locked or barred only once they
 *  have tried it, or hold its key, or see the bolt on their side; blocked rubble shows to anyone) */
export type MapWay = { kind: string; shut?: 'locked' | 'barred' | 'blocked'; open?: true; key?: true;
  /** barred: the title its bolt is on, the side it opens from (Barrier.bar.side, BA4) */
  side?: string };
/** at (BG-313): the way's doorway on the floor plan (Opening.at, metres), and out: the unit step from this title out
 *  through it (metres, y up), so the map draws its door and its exit arrow where the doorway really is; opening: its id,
 *  shared by both titles' links; widthM: its width along its wall (Opening.widthM); wall: a wall stands where it is cut; stairs: a way up or down (OP stairs), up
 *  when its other end is higher */
export type MapLink = { to: string; label: string; sight: boolean; frontier: boolean; known: boolean; otherPlace?: string; way?: MapWay;
  at?: Pt; out?: [number, number]; opening?: string; widthM?: number; wall?: true; stairs?: true; up?: boolean;
  /** MAP-87: the opening's height and sill (Opening.heightM, sillM), its hole in the 3D view's wall */
  heightM?: number; sillM?: number };
/** MAP-68: everyone the character perceives, each at their own point in metres in the map's frame, wherever it lies:
 * at, for someone in full sight, where they stand (SeenActor.body); lastAt, for someone only heard or glimpsed, or last
 * seen, where the character last perceived them (the journal's last spot, BG-125); with neither (an old save) they are
 * not drawn and only the card of the title they are listed in names them (listed). height: the floor their point is on;
 * body (SZ16): its floor size in metres and the way it faces, for
 * someone seen clearly at their own point, or out of full sight the body last seen clearly (journal.lastBody, RX1 a) */
export type MapPerson = { id: string; name: string; now: boolean; at?: { x: number; y: number }; lastAt?: { x: number; y: number }; body?: { lengthM: number; widthM: number; facing: [number, number] }; icon: IconName;
  height: number; listed?: string };
/** MAP-69: the icon for what the character sees on someone first: what they hold (a weapon or a tool), a shield, armour
 *  past plain clothes, wares they offer; else what they are, from the race seen, a plain person by their life stage and
 *  pronouns (RM15 c); someone not made out (only glimpsed or heard, or out of sight now) shows a hooded figure. Only the
 *  PlayerView is read (MAP-40) */
function personIcon(s: GameState, a: SeenActor): IconName {
  if (a.level !== 'full') return 'someone';
  for (const where of ['held', 'shield', 'armor'] as const) for (const g of a.gear) {
    const item = g.where === where ? instanceItem(s, g.id) : undefined, icon = item && iconName(s, item);
    if (icon && icon !== 'tunic') return icon;
  }
  const kind = a.wares?.length ? 'trader' : kindIconName(a.race);
  if (kind !== 'person') return kind;
  // RM15 c: a plain person by what the view shows of them: the life stage they look ("Ancient++", AG16), else their pronouns
  const stage = a.age && LIFE_STAGES.keyOf(a.age.split('+')[0]);
  if (stage && LIFE_STAGES.pos(stage) >= LIFE_STAGES.pos(CONFIG.MAP_ELDER_FROM)) return 'elder';
  return a.pronouns === 'he' ? 'man' : a.pronouns === 'she' ? 'woman' : 'person';
}
export type MapZone = {
  id: string; placeId: string; name: string; look: string; outdoor: boolean; here: boolean; inView: boolean;
  /** metres above the ground outside: the map shows one height (a floor) at a time */
  height: number;
  /** the box round the title's outline in metres (the layout places marks in it) */
  rect?: import('../types').Rect;
  /** PZ1: the title's outline in metres (counter-clockwise), drawn as its floor */
  outline?: Pt[];
  /** PZ2: the stretches of its outline and what stands on each, as a map class (wall, low, window, open: WALL_CLASS) */
  walls?: { a: Pt; b: Pt; cls: WallClass; /** the state wall standing there (none on an open stretch): MAP-85's wall target */ id?: string;
    /** MAP-87: how high it stands above this floor (Wall.top) */ topM?: number }[];
  light?: string; cover?: string; links: MapLink[]; items: string[];
  /** FR5: the furniture standing there, each at its point in the frame of rect; kind is a furniture kind id (FU), for its icon */
  furniture?: { id: string; name: string; kind: string; x: number; y: number }[];
  /** MAP-86: the things on the ground the character sees there now (PlayerView), each at its point in the frame of rect: its
   *  icon (itemIcons) and its item kind, for the tint */
  things?: MapThingMark[];
  /** where you stand, in the frame of rect (Actor.pos), when you are here and code has placed you */
  you?: { x: number; y: number };
  /** TV7: on a road, how far along it you are: metres from its west (or south) end, of its whole length; on a road bound
   *  to the land (Zone.road), metres from its line's first point, that end named by its compass side */
  along?: { m: number; len: number; from: Compass; to: Compass };
  /** OM10 a: its ground is a road's (a road title: Zone.line, road or danger), drawn in the road's tone with solid edges */
  road?: true;
  /** WZ1: a road bound to a region road line runs along this line, in metres in the world's frame */
  line?: Pt[];
  /** PZ12 a, BG-313: the parts of the title the character has seen (the fog), in metres: the map draws its floor, walls,
   *  doors and furniture only there */
  seen?: SeenRun[];
  /** MAP-33: the parts of `seen` in sight at the latest look, drawn full; the rest of `seen` is drawn faded */
  sight?: SeenRun[];
};
export type MapThingMark = { id: string; name: string; icon: IconName; kind?: string; x: number; y: number };
type Compass = 'west' | 'east' | 'south' | 'north';
type Pt = { x: number; y: number };
export type MapPlace = { id: string; name: string; kind: string; parentId: string | null; depth: number; zones: MapZone[]; facts: string[] };
/** WZ4 a region's land as the character knows it: the cells made out, and the sites known by word only (drawn faint) */
export type MapLand = { region: import('../types').Region; seen: (i: number) => boolean; faint: Set<string>; /** changes when the cells seen do */ key: string };
/** youWidthM: your own body's width in metres, your pin's width on the plan (MAP-23; OM4b a) */
export type KnownMap = { placeId: string; zoneId: string; places: MapPlace[]; land?: MapLand[]; people: MapPerson[]; youWidthM?: number };

/** FR5: a zone's furniture with its points, for the map's icons */
function furnitureOn(s: GameState, zoneId: string): Pick<MapZone, 'furniture'> {
  const out = furnitureIn(s, zoneId).flatMap((f) => { const p = furniturePos(s, zoneId, f); return p ? [{ id: f.id, name: f.name, kind: f.kind, x: p.x, y: p.y }] : []; });
  return out.length ? { furniture: out } : {};
}
const safe = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };
/** MAP-86: what lies on the ground of a zone in view, as PlayerView lists it, at its point (PZ11 a: everything on the ground has one) */
function thingsOn(s: GameState, seen: { id: string; name: string }[]): Pick<MapZone, 'things'> {
  const out = seen.flatMap((g) => {
    const it = s.ground.find((i) => i.id === g.id), kind = it && safe(() => itemDef(s, it.itemId).kind);
    return it?.at ? [{ id: g.id, name: g.name, icon: iconName(s, it.itemId), ...(kind ? { kind } : {}), x: it.at.x, y: it.at.y }] : [];
  });
  return out.length ? { things: out } : {};
}

/** how the map draws a wall kind (WK): a solid wall, a low one (counter, fence, rail), glass, or nothing standing */
export type WallClass = 'wall' | 'low' | 'window' | 'open';
export const WALL_CLASS: Record<string, WallClass> = { [WK.wall]: 'wall', [WK.open]: 'open', [WK.low]: 'low', [WK.glazed]: 'window', [WK.fence]: 'low', [WK.arcade]: 'low' };
/** PZ2: each side of a title's outline split into the stretches the plan's walls stand on (on its floor), the rest open */
export function wallsOn(s: GameState, z: import('../types').Zone): NonNullable<MapZone['walls']> {
  const out: NonNullable<MapZone['walls']> = [];
  const mine = s.walls.filter((w) => w.placeId === z.placeId && w.floor <= z.floor + 0.01 && w.top > z.floor + 0.01);
  for (const [a, b] of sidesOf(z.outline)) {
    const len = dist(a, b);
    if (len < NEAR_M) continue;
    const on = mine.flatMap((w) => {
      const p = toSegment(w.a, a, b), q = toSegment(w.b, a, b);
      if (p.d > WALL_ON_M || q.d > WALL_ON_M) return [];
      const t0 = Math.max(0, Math.min(p.t, q.t)), t1 = Math.min(1, Math.max(p.t, q.t));
      return t1 - t0 > NEAR_M / len ? [{ t0, t1, cls: WALL_CLASS[w.kind] ?? 'wall', id: w.id, topM: w.top - z.floor }] : [];
    }).sort((x, y) => x.t0 - y.t0);
    let t = 0;
    for (const w of on) {
      if (w.t0 > t + NEAR_M / len) out.push({ a: lerp(a, b, t), b: lerp(a, b, w.t0), cls: 'open' });
      if (w.t1 > t) out.push({ a: lerp(a, b, Math.max(t, w.t0)), b: lerp(a, b, w.t1), cls: w.cls, id: w.id, topM: w.topM });
      t = Math.max(t, w.t1);
    }
    if (t < 1 - NEAR_M / len) out.push({ a: lerp(a, b, t), b: { ...b }, cls: 'open' });
  }
  return out;
}
/** how far off a title's side a wall may lie and still stand on it, in metres (the drawn plan's rounding) */
const WALL_ON_M = 0.05;

/** BG-313: the unit step out of title `z` through an opening at `at` (metres, y up): the normal of the outline side the
 *  opening stands on, the way that leaves the title */
export function outOf(z: import('../types').Zone, at: Pt): [number, number] | undefined {
  let best: { d: number; a: Pt; b: Pt } | undefined;
  for (const [a, b] of sidesOf(z.outline)) { const d = toSegment(at, a, b).d; if (!best || d < best.d) best = { d, a, b }; }
  if (!best) return undefined;
  const dx = best.b.x - best.a.x, dy = best.b.y - best.a.y, l = Math.hypot(dx, dy) || 1, n: [number, number] = [dy / l, -dx / l];
  const probe = { x: at.x + n[0] * 0.2, y: at.y + n[1] * 0.2 };
  return inOutline(probe, z.outline, 0.01) ? [-n[0], -n[1]] : n;
}
/** WZ1: a point on a road line: metres along it from its first point to the point of the line nearest `at` */
export function alongLine(pts: Pt[], at: Pt): NonNullable<MapZone['along']> {
  let best = Infinity, m = 0, run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    const t = l ? Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / (l * l))) : 0;
    const d = Math.hypot(a.x + t * dx - at.x, a.y + t * dy - at.y);
    if (d < best) { best = d; m = run + t * l; }
    run += l;
  }
  const a = pts[0], b = pts[pts.length - 1], ew = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const from: Compass = ew ? (a.x <= b.x ? 'west' : 'east') : (a.y <= b.y ? 'south' : 'north');
  const opp: Record<Compass, Compass> = { west: 'east', east: 'west', south: 'north', north: 'south' };
  return { m, len: run, from, to: opp[from] };
}
/** WZ1: the point `m` metres along a line from its first point (clamped to its ends) */
export function pointAlong(pts: Pt[], m: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (m <= l || i === pts.length - 1) { const t = l ? Math.max(0, Math.min(1, m / l)) : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    m -= l;
  }
  return { ...pts[0] };
}

/** TV7: a point on a road, measured along the road's long side from its west end (or south end, for a north-south road) */
export function alongRoad(r: import('../types').Rect, at: { x: number; y: number }): NonNullable<MapZone['along']> {
  const ew = r.w >= r.d, len = ew ? r.w : r.d;
  const m = Math.max(0, Math.min(len, ew ? at.x - (r.x - r.w / 2) : at.y - (r.y - r.d / 2)));
  return ew ? { m, len, from: 'west', to: 'east' } : { m, len, from: 'south', to: 'north' };
}

export function knownMap(s: GameState): KnownMap {
  const p = s.player, pv = safe(() => buildPlayerView(s));
  const inView = new Map((pv?.zones ?? []).map((z) => [z.id, z]));
  const known = new Set<string>([...knownZoneIds(s), ...inView.keys()]);
  for (const id of [...known]) if (!zoneById(s, id)) known.delete(id);

  // people (MAP-68): seen now (PlayerView) and last seen, each at their own point; the title they are listed in plays no
  // part in where they are drawn
  const people: (MapPerson & { zone: string })[] = [];
  /** MAP-68: out of full sight, the point where the character last saw or heard them, on its own floor, and the body last
   *  seen clearly (RX1 a), if ever */
  const lastAt = (id: string, zone: string): Pick<MapPerson, 'lastAt' | 'height' | 'body'> => {
    const spot = p.journal?.lastSpot?.[id], body = p.journal?.lastBody?.[id];
    return spot ? { lastAt: { x: spot.x, y: spot.y }, height: spot.floor, ...(body ? { body: { ...body } } : {}) } : { height: heightOf(zoneById(s, zone)) };
  };
  for (const a of pv?.actors ?? []) {
    if (a.id === p.id) continue;
    const b = a.body; // SZ16: seen clearly, so where they stand, their size and facing are seen too (MAP-40: from the view)
    people.push({ id: a.id, name: a.name ?? a.label, now: true, icon: personIcon(s, a), zone: a.zone,
      ...(b ? { at: { x: b.x, y: b.y }, height: heightOf(zoneById(s, a.zone)), body: { lengthM: b.lengthM, widthM: b.widthM, facing: b.facing } } : lastAt(a.id, a.zone)) });
  }
  // BG-1555: someone perceived now is drawn from actors; lastSeen also holds the half seen (BG-155: their known wares)
  for (const a of (pv?.lastSeen ?? []).filter((x) => !pv?.actors.some((y) => y.id === x.id))) people.push({ id: a.id, name: a.name, now: false, icon: 'someone', zone: a.zone, ...lastAt(a.id, a.zone) });

  const byPlace = new Map<string, MapZone[]>();
  for (const id of known) {
    const z = zoneById(s, id)!, v = inView.get(id);
    const links: MapLink[] = waysOut(s, z.id).map((l) => {
      const to = zoneById(s, l.to);
      const otherPlace = to && to.placeId !== z.placeId ? s.places.find((x) => x.id === to.placeId)?.names.current : undefined;
      const b = barrierOn(s, l), w = b ? barrierView(b, p, z.id) : undefined;
      const way: MapWay | undefined = w && { kind: w.kind, ...(w.blocked ? { shut: 'blocked' as const } : w.barred ? { shut: 'barred' as const } : w.locked ? { shut: 'locked' as const } : {}),
        ...(w.open ? { open: true as const } : {}), ...(w.key ? { key: true as const } : {}), ...(w.barred && !w.blocked && b?.bar ? { side: b.bar.side } : {}) };
      // stairs: drawn at their end on this title's floor; up when the other end is higher
      const o = l.opening, stairs = o.kind === OP.stairs, hi = Math.max(o.floor, o.to?.floor ?? o.floor);
      const end = stairs && o.to && Math.abs(o.to.floor - z.floor) < Math.abs(o.floor - z.floor) ? o.to : o.at, out = stairs ? undefined : outOf(z, o.at);
      return { to: l.to, label: l.label, sight: seesAcross(s, l), frontier: !!l.frontier && !to, known: known.has(l.to), ...(otherPlace ? { otherPlace } : {}), ...(way ? { way } : {}),
        at: { x: end.x, y: end.y }, ...(out ? { out } : {}), opening: o.id, widthM: o.widthM, heightM: o.heightM, ...(o.sillM ? { sillM: o.sillM } : {}), ...(o.wall ? { wall: true as const } : {}), ...(stairs ? { stairs: true as const, up: z.floor < hi - 0.01 } : {}) };
    });
    const placed = !!z.outline?.length, box = placed ? boxOf(z.outline) : undefined;
    const you = id === p.zone && p.pos && placed ? { x: p.pos.x, y: p.pos.y } : undefined;
    const line = z.line; // WZ1, PZ14: a road runs along its line
    const mz: MapZone = { id, placeId: z.placeId, name: z.name, look: z.look, outdoor: !roofed(s, z), here: id === p.zone, inView: !!v, height: heightOf(z),
      ...(box ? { rect: box, outline: z.outline.map((q) => ({ x: q.x, y: q.y })), walls: wallsOn(s, z), ...furnitureOn(s, id), ...(v ? thingsOn(s, v.groundItems) : {}), seen: seenRuns(s, z), sight: seenRuns(s, z, { inView: !!v }) } : {}), links,
      ...(you ? { you } : {}), ...(line ? { line } : {}), ...(line || z.road || z.danger ? { road: true as const } : {}),
      ...(you && line ? { along: alongLine(line, you) } : {}),
      items: v ? v.groundItems.map((i) => i.name) : [], ...(v ? { light: v.light, cover: v.cover } : {}) };
    if (!byPlace.has(z.placeId)) byPlace.set(z.placeId, []);
    byPlace.get(z.placeId)!.push(mz);
  }

  // places: the Journal's (current, the places above it, places of witnessed facts) plus every place with a known zone
  const jp = new Map(journalPlaces(s).map((x) => [x.id, x]));
  const ids = new Set([...jp.keys(), ...byPlace.keys()]);
  const byId = new Map(s.places.map((x) => [x.id, x]));
  const depth = (id: string) => { let d = 0; for (let q = byId.get(id); q?.parentId && d < 20; q = byId.get(q.parentId)) d++; return d; };
  const places: MapPlace[] = [...ids].flatMap((id) => {
    const pl = byId.get(id);
    return pl ? [{ id, name: pl.names.current, kind: pl.kind, parentId: pl.parentId, depth: depth(id), zones: byPlace.get(id) ?? [], facts: jp.get(id)?.facts ?? [] }] : [];
  });
  // a tree order: each place right after its parent
  const order: MapPlace[] = [];
  const visit = (parent: string | null) => { for (const x of places.filter((q) => (q.parentId && ids.has(q.parentId) ? q.parentId : null) === parent)) { order.push(x); visit(x.id); } };
  visit(null);
  // WZ4: each region's land the character has made out; a site is known by word once its place is (the Journal's)
  const land: MapLand[] = (s.regions ?? []).map((r) => ({ region: r, seen: landSeen(s, r.id), faint: new Set(r.sites.filter((x) => x.placeId && ids.has(x.placeId)).map((x) => x.id)),
    key: `${r.id}:${s.player.journal?.landSeen?.[r.id] ?? ''}` }));
  const km: KnownMap = { placeId: p.placeId, zoneId: p.zone, places: order, land, people: [], youWidthM: actorBody(s, p).size.widthM };
  km.people = people.map(({ zone, ...w }) => ({ ...w, ...(w.at || w.lastAt ? {} : { listed: zone }) }));
  return km;
}

/** MAP-64: the people a zone's card names, found from their points: those whose point lies in the zone, the smallest known
 *  zone on its floor that holds it (MAP-11: zones nest); someone with no point, in the card of the title listing them */
export function peopleIn(m: KnownMap, z: MapZone): MapPerson[] {
  const zones = m.places.flatMap((p) => p.zones).filter((q) => q.outline?.length && Math.abs(q.height - z.height) < 0.01);
  const holds = (q: MapZone, pt: Pt) => inOutline(pt, q.outline!, 0.01);
  return m.people.filter((w) => {
    const pt = w.at ?? w.lastAt;
    if (!pt) return w.listed === z.id;
    if (Math.abs(w.height - z.height) >= 0.01 || !z.outline?.length || !holds(z, pt)) return false;
    return !zones.some((q) => q !== z && holds(q, pt) && areaOf(q.outline!) < areaOf(z.outline!));
  });
}

/** the top-level place a place sits in (itself when it has no known parent). A road is only a line on the World map, so a
 *  place along it (a waystation) stops below the road and is a map of its own */
export function rootPlace(m: KnownMap, id: string): string {
  const byId = new Map(m.places.map((p) => [p.id, p]));
  let p = byId.get(id);
  for (let n = 0; p?.parentId && byId.has(p.parentId) && byId.get(p.parentId)!.kind !== 'road' && n < 20; n++) p = byId.get(p.parentId);
  return p?.id ?? id;
}

/** CO9: a place's real extent, the box around its known zones' rectangles (every floor), in metres; none when code has not
 *  placed all of them */
export function extentOf(zones: MapZone[]): import('../types').Rect | undefined {
  if (!zones.length || !zones.every((z) => z.rect)) return undefined;
  const x0 = Math.min(...zones.map((z) => z.rect!.x - z.rect!.w / 2)), x1 = Math.max(...zones.map((z) => z.rect!.x + z.rect!.w / 2));
  const y0 = Math.min(...zones.map((z) => z.rect!.y - z.rect!.d / 2)), y1 = Math.max(...zones.map((z) => z.rect!.y + z.rect!.d / 2));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0 };
}

/** the World view: one tile per top-level place you know (a village, a field, a road, a waystation along a road), joined by
 *  the roads you know between them. Each tile is a MapZone whose id is the place's id, so the map's layout and drawing serve both views. */
export function worldTiles(m: KnownMap): MapZone[] {
  const roots = m.places.filter((p) => rootPlace(m, p.id) === p.id);
  const zoneRoot = new Map(m.places.flatMap((p) => p.zones.map((z) => [z.id, rootPlace(m, p.id)] as const)));
  const here = rootPlace(m, m.placeId);
  return roots.map((r) => {
    const inner = m.places.filter((p) => rootPlace(m, p.id) === r.id);
    const zones = inner.flatMap((p) => p.zones);
    const links: MapLink[] = [];
    for (const z of zones) for (const l of z.links) {
      const to = zoneRoot.get(l.to);
      if (to && to !== r.id && !links.some((x) => x.to === to)) links.push({ to, label: l.label, sight: false, frontier: false, known: true });
    }
    const n = zones.length;
    const along = zones.find((z) => z.along)?.along, line = zones.find((z) => z.line)?.line;
    const rect = extentOf(zones);
    return { id: r.id, placeId: r.id, name: r.name, look: n ? `${plural(n, 'zone')} known` : 'no zones known', outdoor: true,
      here: r.id === here, inView: r.id === here, height: 0, links, items: [], ...(along ? { along } : {}), ...(line ? { line } : {}), ...(rect ? { rect } : {}) };
  });
}
