// The Map page's data: only what the character knows. Zones it stood in or saw across a sight link (journal.zonesSeen),
// what it sees now (PlayerView), its trail, and the places the Journal lists. Never the hidden store: light, cover,
// people and things on the ground show only for zones in view now; a remembered zone keeps its name, look and exits.
import type { GameState } from '../types';
import { buildPlayerView } from '../views';
import { zoneById } from '../engine/relations';
import { journalPlaces } from './pages';

export type MapLink = { to: string; label: string; sight: boolean; frontier: boolean; known: boolean; otherPlace?: string };
export type MapPerson = { id: string; name: string; now: boolean };
export type MapZone = {
  id: string; placeId: string; name: string; look: string; outdoor: boolean; here: boolean; inView: boolean;
  light?: string; cover?: string; links: MapLink[]; people: MapPerson[]; items: string[];
};
export type MapPlace = { id: string; name: string; kind: string; parentId: string | null; depth: number; zones: MapZone[]; facts: string[] };
export type KnownMap = { placeId: string; zoneId: string; places: MapPlace[] };

const safe = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };

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
    const mz: MapZone = { id, placeId: z.placeId, name: z.name, look: z.look, outdoor: !!z.outdoor, here: id === p.zone, inView: !!v, links,
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

/** a compass hint from an exit's words ("north gate", "the east road"); null when it names no direction */
export function compassOf(label: string): [number, number] | null {
  let x = 0, y = 0;
  for (const w of label.toLowerCase().split(/[^a-z]+/)) {
    const m = w.match(/^(north|south)?(east|west)?(ward|wards|ern)?$/);
    if (m && (m[1] || m[2])) { if (m[1] === 'north') y -= 1; if (m[1] === 'south') y += 1; if (m[2] === 'east') x += 1; if (m[2] === 'west') x -= 1; }
    else if (w === 'up' || w === 'upstairs' || w === 'above' || w === 'loft' || w === 'roof') y -= 1;
    else if (w === 'down' || w === 'downstairs' || w === 'below' || w === 'cellar') y += 1;
  }
  if (!x && !y) return null;
  const n = Math.hypot(x, y);
  return [x / n, y / n];
}
