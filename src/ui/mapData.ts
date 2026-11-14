// The Map page's data: only what the character knows. Zones it stood in or saw across a sight link (journal.zonesSeen),
// what it sees now (PlayerView), its trail, and the places the Journal lists. Never the hidden store: light, cover,
// people and things on the ground show only for zones in view now; a remembered zone keeps its name, look and exits.
import { furnitureIn, furniturePos } from '../engine/furniture';
import { compassOf as geoCompass } from '../scenario/geometry';
import type { GameState } from '../types';
import { buildPlayerView } from '../views';
import { seesAcross, zoneById } from '../engine/relations';
import { knownZoneIds, visitedZoneIds } from '../engine/trail';
import { journalPlaces } from './pages';
import { heightOf } from '../scenario/heights';
import { ZK } from '../library/tableIds';
import { barrierOn, barrierView } from '../engine/barriers';
import { landSeen } from '../land/sight';

/** a barrier on an exit as the character knows it: what it is, and whether it stops them (locked or barred only once they
 *  have tried it, or hold its key, or see the bolt on their side; blocked rubble shows to anyone) */
export type MapWay = { kind: string; shut?: 'locked' | 'barred' | 'blocked'; open?: true; key?: true };
export type MapLink = { to: string; label: string; sight: boolean; frontier: boolean; known: boolean; otherPlace?: string; way?: MapWay };
/** at: where they stand (Actor.pos, metres in the map's frame), only for someone in full sight on a zone with a rectangle;
 * someone only heard or glimpsed, or last seen, has no point: the player can't tell where in the zone they are */
export type MapPerson = { id: string; name: string; now: boolean; at?: { x: number; y: number } };
export type MapZone = {
  id: string; placeId: string; name: string; look: string; outdoor: boolean; here: boolean; inView: boolean;
  /** metres above the ground outside: the map shows one height (a floor) at a time */
  height: number;
  /** the zone's rectangle in metres and its sides' edge kinds, when code has placed it (drawn by the To scale view) */
  rect?: import('../types').Rect; edges?: import('../types').Zone['edges'];
  light?: string; cover?: string; links: MapLink[]; people: MapPerson[]; items: string[];
  /** FR5: the furniture standing there, each at its point in the frame of rect; kind is a furniture kind id (FU), for its icon */
  furniture?: { id: string; name: string; kind: string; x: number; y: number }[];
  /** where you stand, in the frame of rect (Actor.pos), when you are here and code has placed you */
  you?: { x: number; y: number };
  /** TV7: on a road, how far along it you are: metres from its west (or south) end, of its whole length */
  along?: { m: number; len: number; from: 'west' | 'south'; to: 'east' | 'north' };
};
export type MapPlace = { id: string; name: string; kind: string; parentId: string | null; depth: number; zones: MapZone[]; facts: string[] };
/** WZ4 a region's land as the character knows it: the cells made out, and the sites known by word only (drawn faint) */
export type MapLand = { region: import('../types').Region; seen: (i: number) => boolean; faint: Set<string> };
export type KnownMap = { placeId: string; zoneId: string; places: MapPlace[]; /** zones the player has stood in (MAP-33) */ visited: string[]; land?: MapLand[] };

/** FR5: a zone's furniture with its points, for the map's icons */
function furnitureOn(s: GameState, zoneId: string): Pick<MapZone, 'furniture'> {
  const out = furnitureIn(s, zoneId).flatMap((f) => { const p = furniturePos(s, zoneId, f); return p ? [{ id: f.id, name: f.name, kind: f.kind, x: p.x, y: p.y }] : []; });
  return out.length ? { furniture: out } : {};
}
const safe = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };

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

  // people: seen now (PlayerView) and last seen (out of sight now, in the zone they were last seen in)
  const people = new Map<string, MapPerson[]>();
  const add = (zone: string, x: MapPerson) => { if (!people.has(zone)) people.set(zone, []); people.get(zone)!.push(x); };
  for (const a of pv?.actors ?? []) {
    if (a.id === p.id) continue;
    const pos = a.level === 'full' ? s.actors.find((x) => x.id === a.id)?.pos : undefined;
    add(a.zone, { id: a.id, name: a.name ?? a.label, now: true, ...(pos && zoneById(s, a.zone)?.rect ? { at: { x: pos.x, y: pos.y } } : {}) });
  }
  for (const a of pv?.lastSeen ?? []) add(a.zone, { id: a.id, name: a.name, now: false });

  const byPlace = new Map<string, MapZone[]>();
  for (const id of known) {
    const z = zoneById(s, id)!, v = inView.get(id);
    const links: MapLink[] = z.links.map((l) => {
      const to = zoneById(s, l.to);
      const otherPlace = to && to.placeId !== z.placeId ? s.places.find((x) => x.id === to.placeId)?.names.current : undefined;
      const b = barrierOn(s, l), w = b ? barrierView(b, p, z.id) : undefined;
      const way: MapWay | undefined = w && { kind: w.kind, ...(w.blocked ? { shut: 'blocked' as const } : w.barred ? { shut: 'barred' as const } : w.locked ? { shut: 'locked' as const } : {}),
        ...(w.open ? { open: true as const } : {}), ...(w.key ? { key: true as const } : {}) };
      return { to: l.to, label: l.label, sight: seesAcross(s, l), frontier: !!l.frontier && !to, known: known.has(l.to), ...(otherPlace ? { otherPlace } : {}), ...(way ? { way } : {}) };
    });
    const you = id === p.zone && p.pos && z.rect ? { x: p.pos.x, y: p.pos.y } : undefined;
    const mz: MapZone = { id, placeId: z.placeId, name: z.name, look: z.look, outdoor: !!z.outdoor, here: id === p.zone, inView: !!v, height: heightOf(z), ...(z.rect ? { rect: z.rect, edges: z.edges, ...furnitureOn(s, id) } : {}), links,
      ...(you ? { you } : {}), ...(you && z.kind === ZK.road ? { along: alongRoad(z.rect!, you) } : {}),
      people: people.get(id) ?? [], items: v ? v.groundItems.map((i) => i.name) : [], ...(v ? { light: v.light, cover: v.cover } : {}) };
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
  const land: MapLand[] = (s.regions ?? []).map((r) => ({ region: r, seen: landSeen(s, r.id), faint: new Set(r.sites.filter((x) => x.placeId && ids.has(x.placeId)).map((x) => x.id)) }));
  return { placeId: p.placeId, zoneId: p.zone, places: order, visited: visitedZoneIds(s), land };
}

/** a compass hint from an exit's words ("north gate", "the east road"); null when it names no direction. Up and down are
 *  heights, not directions (src/scenario/heights.ts verticalOf): stairs never push a zone north or south. */
export function compassOf(label: string): [number, number] | null {
  const c = geoCompass(label); // the scenario's reading of compass words, flipped to screen (y down)
  return c ? [c[0], -c[1] || 0] : null;
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
    const along = zones.find((z) => z.along)?.along;
    const rect = extentOf(zones);
    return { id: r.id, placeId: r.id, name: r.name, look: n ? `${n} zone${n === 1 ? '' : 's'} known` : 'no zones known', outdoor: true,
      here: r.id === here, inView: r.id === here, height: 0, links, people: [], items: [], ...(along ? { along } : {}), ...(rect ? { rect } : {}) };
  });
}
