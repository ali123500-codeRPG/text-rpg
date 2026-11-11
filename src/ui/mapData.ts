// The Map page's data: only what the character knows. Zones it stood in or saw across a sight link (journal.zonesSeen),
// what it sees now (PlayerView), its trail, and the places the Journal lists. Never the hidden store: light, cover,
// people and things on the ground show only for zones in view now; a remembered zone keeps its name, look and exits.
import { compassOf as geoCompass } from '../scene/geometry';
import type { GameState } from '../types';
import { buildPlayerView } from '../views';
import { zoneById } from '../engine/relations';
import { journalPlaces } from './pages';
import { heightOf } from '../scene/heights';
import { ZK } from '../library/tableIds';

export type MapLink = { to: string; label: string; sight: boolean; frontier: boolean; known: boolean; otherPlace?: string };
export type MapPerson = { id: string; name: string; now: boolean };
export type MapZone = {
  id: string; placeId: string; name: string; look: string; outdoor: boolean; here: boolean; inView: boolean;
  /** metres above the ground outside: the map shows one height (a floor) at a time */
  height: number;
  /** the zone's rectangle in metres and its sides' edge kinds, when code has placed it (drawn by the To scale view) */
  rect?: import('../types').Rect; edges?: import('../types').Zone['edges'];
  light?: string; cover?: string; links: MapLink[]; people: MapPerson[]; items: string[];
  /** where you stand, in the frame of rect (Actor.pos), when you are here and code has placed you */
  you?: { x: number; y: number };
  /** TV7: on a road, how far along it you are: metres from its west (or south) end, of its whole length */
  along?: { m: number; len: number; from: 'west' | 'south'; to: 'east' | 'north' };
};
export type MapPlace = { id: string; name: string; kind: string; parentId: string | null; depth: number; zones: MapZone[]; facts: string[] };
export type KnownMap = { placeId: string; zoneId: string; places: MapPlace[] };

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
  const known = new Set<string>([...(p.journal?.zonesSeen ?? []), ...inView.keys(), ...(p.journal?.trail ?? []).map((t) => t.zone), p.zone]);
  for (const id of [...known]) if (!zoneById(s, id)) known.delete(id);

  // people: seen now (PlayerView) and last seen (out of sight now, in the zone they were last seen in)
  const people = new Map<string, MapPerson[]>();
  const add = (zone: string, x: MapPerson) => { if (!people.has(zone)) people.set(zone, []); people.get(zone)!.push(x); };
  for (const a of pv?.actors ?? []) if (a.id !== p.id) add(a.zone, { id: a.id, name: a.name ?? a.label, now: true });
  for (const a of pv?.lastSeen ?? []) add(a.zone, { id: a.id, name: a.name, now: false });

  const byPlace = new Map<string, MapZone[]>();
  for (const id of known) {
    const z = zoneById(s, id)!, v = inView.get(id);
    const links: MapLink[] = z.links.map((l) => {
      const to = zoneById(s, l.to);
      const otherPlace = to && to.placeId !== z.placeId ? s.places.find((x) => x.id === to.placeId)?.names.current : undefined;
      return { to: l.to, label: l.label, sight: l.sight, frontier: !!l.frontier && !to, known: known.has(l.to), ...(otherPlace ? { otherPlace } : {}) };
    });
    const you = id === p.zone && p.pos && z.rect ? { x: p.pos.x, y: p.pos.y } : undefined;
    const mz: MapZone = { id, placeId: z.placeId, name: z.name, look: z.look, outdoor: !!z.outdoor, here: id === p.zone, inView: !!v, height: heightOf(z), ...(z.rect ? { rect: z.rect, edges: z.edges } : {}), links,
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
  return { placeId: p.placeId, zoneId: p.zone, places: order };
}

/** a compass hint from an exit's words ("north gate", "the east road"); null when it names no direction. Up and down are
 *  heights, not directions (src/scene/heights.ts verticalOf): stairs never push a zone north or south. */
export function compassOf(label: string): [number, number] | null {
  const c = geoCompass(label); // the scene's reading of compass words, flipped to screen (y down)
  return c ? [c[0], -c[1] || 0] : null;
}

/** the top-level place a place sits in (itself when it has no known parent) */
export function rootPlace(m: KnownMap, id: string): string {
  const byId = new Map(m.places.map((p) => [p.id, p]));
  let p = byId.get(id);
  for (let n = 0; p?.parentId && byId.has(p.parentId) && n < 20; n++) p = byId.get(p.parentId);
  return p?.id ?? id;
}

/** the World view: one tile per top-level place you know (a village, a field, a road), joined by the roads you know between
 *  them. Each tile is a MapZone whose id is the place's id, so the map's layout and drawing serve both views. */
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
    return { id: r.id, placeId: r.id, name: r.name, look: n ? `${n} zone${n === 1 ? '' : 's'} known` : 'no zones known', outdoor: true,
      here: r.id === here, inView: r.id === here, height: 0, links, people: [], items: [], ...(along ? { along } : {}) };
  });
}
