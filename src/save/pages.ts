// GameState <-> saved pages (Part 4 §6, §9), stable hashing and size budgets.
import type { Actor, ActorPage, BlueprintPage, EnginePage, FactsPage, GameEvent, GameState, Head, HiddenPage, Place, Pt, RecentEntry, Region, StoryFact, StoryMeta, TilePage } from '../types';
import { CONFIG } from '../config';
import { middleOf } from '../plan/geom';
import { planChanged } from '../plan/stamp';
import { keptBy } from '../perception';

export const PAGE_LIMIT = 256 * 1024; // platform: 256 KiB per document
const FACTS_ENVELOPE = 512; // room for storyId/placeId around the facts array

/** JSON with sorted keys, so a hash never depends on the order the store returns keys in. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : stableStringify(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

/** FNV-1a 32-bit over the stable JSON, as 8 hex digits. */
export function hashPage(page: unknown): string {
  const s = stableStringify(page);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function byteLength(v: unknown): number {
  return new TextEncoder().encode(JSON.stringify(v)).length;
}

export type Pages = Record<string, unknown>;

/** Split one place's facts into pages under the budget (facts.<placeId>.<n>). */
function factsPages(storyId: string, placeId: string, facts: StoryFact[]): FactsPage[] {
  const out: FactsPage[] = [];
  let cur: StoryFact[] = [];
  let size = FACTS_ENVELOPE;
  for (const f of facts) {
    const b = byteLength(f) + 1;
    if (cur.length && size + b > PAGE_LIMIT) {
      out.push({ storyId, placeId, facts: cur });
      cur = [];
      size = FACTS_ENVELOPE;
    }
    cur.push(f);
    size += b;
  }
  if (cur.length) out.push({ storyId, placeId, facts: cur });
  return out;
}

/** WT1 a: the lists saved by tile, each record by its anchor point */
const TILE_LISTS = ['walls', 'openings', 'roofs', 'lights', 'furniture', 'items'] as const;
type TileList = (typeof TILE_LISTS)[number];
type TileLists = Pick<TilePage, TileList>;
const stateList = (k: TileList) => (k === 'items' ? 'ground' : k);
/** the point a record is saved by: a wall's middle, a roof's middle, a way's or light's spot, a piece's or item's point */
function anchorOf(k: TileList, x: TileLists[TileList][number]): Pt {
  const r = x as unknown as Record<string, unknown>;
  if (k === 'walls') { const w = r as unknown as TileLists['walls'][number]; return { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }; }
  if (k === 'roofs') return middleOf((r as unknown as TileLists['roofs'][number]).outline);
  return (k === 'furniture' ? r.pos : r.at) as Pt; // D-1623: everything on the ground has a point (engine/ground dropOnGround)
}
const tileOf = (p: Pt, size: number): [number, number] => [Math.floor(p.x / size), Math.floor(p.y / size)];
const byTile = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];

/** WT1 a: the live state's floor plan and ground put in tile order (by tx, then ty; a stable sort), so a state loaded from its
 * pages has the order of the one saved. The floor plan's look-up grids are rebuilt when walls or ways moved in the list. */
export function inTileOrder(state: GameState, size = CONFIG.TILE_SIZE_M): void {
  let moved = false;
  for (const k of TILE_LISTS) {
    const list = state[stateList(k)] as TileLists[TileList];
    const keyed = list.map((x) => [x, tileOf(anchorOf(k, x), size)] as const);
    const sorted = [...keyed].sort((a, b) => byTile(a[1], b[1]));
    if (sorted.every((e, i) => e === keyed[i])) continue;
    (list as unknown[]).splice(0, list.length, ...sorted.map(([x]) => x));
    if (k === 'walls' || k === 'openings') moved = true;
  }
  if (moved) planChanged();
}

/** WT1 a: the floor plan and ground as tile pages (tile.<tx>.<ty>.<n>), each tile split into parts under the page limit */
export function tilePages(storyId: string, lists: TileLists, size = CONFIG.TILE_SIZE_M): Record<string, TilePage> {
  const tiles = new Map<string, { at: [number, number]; recs: [TileList, unknown][] }>();
  for (const k of TILE_LISTS) for (const x of lists[k]) {
    const at = tileOf(anchorOf(k, x), size), key = `${at[0]}.${at[1]}`;
    let t = tiles.get(key);
    if (!t) tiles.set(key, (t = { at, recs: [] }));
    t.recs.push([k, x]);
  }
  const out: Record<string, TilePage> = {};
  for (const [key, { at: [tx, ty], recs }] of tiles) {
    const empty = (): TilePage => ({ storyId, tx, ty, size, walls: [], openings: [], roofs: [], lights: [], furniture: [], items: [] });
    let n = 0, cur = empty(), bytes = FACTS_ENVELOPE;
    for (const [k, x] of recs) {
      const b = byteLength(x) + 1;
      if (bytes + b > PAGE_LIMIT && TILE_LISTS.some((l) => cur[l].length)) { out[`tile.${key}.${n++}`] = cur; cur = empty(); bytes = FACTS_ENVELOPE; }
      (cur[k] as unknown[]).push(x);
      bytes += b;
    }
    out[`tile.${key}.${n}`] = cur;
  }
  return out;
}

/** D-1621 (WT3 a): each person's share of the world-wide state goes on their own page (ActorPage.own): the recent events they
 * keep (keptBy), each event once, on the first page in actor order that keeps it, so no page holds more than its own person's
 * history; and their memory, plan and drive, off the hidden page. Recent events no one present keeps stay on the engine
 * page. `events` in their order; each is saved with its place among its turn's events, which puts them back in order. */
export function shareOut(pages: Pages, events: readonly GameEvent[]): void {
  const engine = pages.engine as EnginePage, hidden = pages.hidden as HiddenPage;
  const nth = new Map<number, number>();
  const entry = new Map(events.map((e) => { const k = nth.get(e.turn) ?? 0; nth.set(e.turn, k + 1); return [e, [k, e] as RecentEntry] as const; }));
  const left = new Set(events);
  const ids = engine.order?.actors ?? Object.keys(pages).filter((k) => k.startsWith('actor.')).map((k) => (pages[k] as Actor).id);
  for (const id of ids) {
    const a = pages[`actor.${id}`] as ActorPage | undefined;
    if (!a) continue;
    const keeps = new Set(keptBy(id, events)), own: NonNullable<ActorPage['own']> = {};
    const recent = events.filter((e) => keeps.has(e) && left.delete(e));
    if (recent.length) own.recent = recent.map((e) => entry.get(e)!);
    if (hidden.memory[id]) { own.memory = hidden.memory[id]; delete hidden.memory[id]; }
    if (hidden.plans[id]) { own.plan = hidden.plans[id]; delete hidden.plans[id]; }
    if (hidden.drives?.[id]) { own.drive = hidden.drives[id]; delete hidden.drives[id]; }
    if (Object.keys(own).length) a.own = own;
  }
  delete engine.recentEvents;
  const rest = events.filter((e) => left.has(e));
  if (rest.length) engine.recent = rest.map((e) => entry.get(e)!);
}

/** Every page of the story, keyed by page key. Copies: the state is never shared with the store (it is only put in tile
 * order first, inTileOrder). */
export function toPages(state: GameState): Pages {
  inTileOrder(state);
  const s = structuredClone(state);
  const engine: EnginePage = {
    storyId: s.storyId, turn: s.turn, mode: s.mode, rngSeed: s.rngSeed, rngState: s.rngState, pending: s.pending,
    stage: s.stage, scenarioCaps: s.scenarioCaps, clocks: s.clocks, bands: s.bands, quests: s.quests,
    ...(s.spars?.length ? { spars: s.spars } : {}),
    ...(s.yielding ? { yielding: s.yielding } : {}),
    ...(s.offers ? { offers: s.offers } : {}),
    ...(s.mercy ? { mercy: s.mercy } : {}),
    ...(s.barriers && Object.keys(s.barriers).length ? { barriers: s.barriers } : {}),
    ...(s.turnEnds ? { turnEnds: s.turnEnds } : {}),
    order: { actors: [s.player, ...s.actors].map((a) => a.id), places: s.places.map((p) => p.id), ...(s.regions?.length ? { regions: s.regions.map((r) => r.id) } : {}) },
  };
  const hidden: HiddenPage = { storyId: s.storyId, ...s.hidden };
  const pages: Pages = { engine, hidden };
  for (const a of [s.player, ...s.actors]) pages[`actor.${a.id}`] = a;
  shareOut(pages, s.recentEvents ?? []);
  for (const p of s.places) pages[`place.${p.id}`] = p;
  for (const r of s.regions ?? []) pages[`region.${r.id}`] = { ...r, storyId: s.storyId }; // every page carries its story id
  const byPlace = new Map<string, StoryFact[]>();
  for (const f of s.facts) byPlace.set(f.placeId, [...(byPlace.get(f.placeId) ?? []), f]);
  for (const [placeId, facts] of byPlace) factsPages(s.storyId, placeId, facts).forEach((fp, n) => (pages[`facts.${placeId}.${n}`] = fp));
  for (const b of s.blueprints) pages[`blueprint.${b.id}`] = b;
  // WT1 a: the floor plan and the ground by tiles of the world frame
  Object.assign(pages, tilePages(s.storyId, { walls: s.walls, openings: s.openings, roofs: s.roofs, lights: s.lights, furniture: s.furniture, items: s.ground }));
  return pages;
}

const orderBy = <T extends { id: string }>(items: T[], ids: string[] | undefined): T[] =>
  ids ? [...items].sort((a, b) => (ids.indexOf(a.id) + 1 || Infinity) - (ids.indexOf(b.id) + 1 || Infinity)) : items;

/** Build the in-memory state from checked pages. */
export function fromPages(meta: StoryMeta, head: Head, pages: Pages): GameState {
  const p = structuredClone(pages);
  const engine = p.engine as EnginePage;
  const { storyId: _s, ...hidden } = p.hidden as HiddenPage;
  const of = <T>(prefix: string) => Object.keys(p).filter((k) => k.startsWith(prefix)).map((k) => p[k] as T);
  // D-1621: each person's share back where play keeps it
  const own = of<ActorPage>('actor.').flatMap((a) => { const o = a.own; delete a.own; return o ? [[a.id, o] as const] : []; });
  for (const [id, o] of own) {
    if (o.memory) hidden.memory[id] = o.memory;
    if (o.plan) hidden.plans[id] = o.plan;
    if (o.drive) (hidden.drives ??= {})[id] = o.drive;
  }
  const recentEvents = [...(engine.recent ?? []), ...own.flatMap(([, o]) => o.recent ?? [])]
    .sort(([ka, a], [kb, b]) => a.turn - b.turn || ka - kb).map(([, e]) => e);
  const actors = orderBy(of<Actor>('actor.'), engine.order?.actors);
  const places = orderBy(of<Place>('place.'), engine.order?.places);
  const regions = orderBy(of<Region & { storyId?: string }>('region.'), engine.order?.regions).map(({ storyId: _r, ...r }) => r);
  const factKeys = Object.keys(p).filter((k) => k.startsWith('facts.'))
    .sort((a, b) => { const na = +a.slice(a.lastIndexOf('.') + 1), nb = +b.slice(b.lastIndexOf('.') + 1); return a.slice(0, a.lastIndexOf('.')).localeCompare(b.slice(0, b.lastIndexOf('.'))) || na - nb; });
  // shortcut: facts come back grouped by place then sorted by turn (stable), which is chronological per place
  const facts = factKeys.flatMap((k) => (p[k] as FactsPage).facts).map((f, i) => [f, i] as const)
    .sort((a, b) => a[0].turn - b[0].turn || a[1] - b[1]).map(([f]) => f);
  const zoneById = new Map(places.flatMap((pl) => pl.zones.map((z) => [z.id, z] as const)));
  // WT1 a: tiles in tile order (by tx, then ty), each tile's parts in turn, as inTileOrder left the lists
  const tiles = Object.keys(p).filter((k) => k.startsWith('tile.')).map((k) => [p[k] as TilePage, +k.slice(k.lastIndexOf('.') + 1)] as const)
    .sort(([a, na], [b, nb]) => byTile([a.tx, a.ty], [b.tx, b.ty]) || na - nb).map(([t]) => t);
  const tiled = <K extends TileList>(k: K): TilePage[K] => tiles.flatMap((t) => (t[k] ?? []) as unknown[]) as TilePage[K];
  const player = actors.find((a) => a.kind === 'player')!;
  const { order: _o, storyId: _e, turn, mode, rngSeed, rngState, pending, stage, scenarioCaps, clocks, bands, quests, spars, yielding, offers, mercy, barriers, turnEnds } = engine;
  return {
    storyId: meta.storyId, turn, mode,
    zones: [...zoneById.values()], // WI8 a: every built zone is live
    player, actors: actors.filter((a) => a !== player), bands,
    hidden, events: [], agentLog: [], log: [], ...(recentEvents.length ? { recentEvents } : {}), ...(spars?.length ? { spars } : {}), ...(yielding ? { yielding } : {}), ...(offers ? { offers } : {}), ...(mercy ? { mercy } : {}), ...(barriers ? { barriers } : {}), ...(turnEnds ? { turnEnds } : {}),
    rngSeed, rngState, pending, places, ...(regions.length ? { regions } : {}), facts, stage: (({ zoneIds: _z, ...st }) => st)(stage as typeof stage & { zoneIds?: string[] }), scenarioCaps, clocks, quests,
    settings: structuredClone(meta.settings), libraryVersion: head.libraryVersion,
    blueprints: of<BlueprintPage>('blueprint.'), meta: structuredClone(meta),
    walls: tiled('walls'), openings: tiled('openings'), roofs: tiled('roofs'), lights: tiled('lights'), furniture: tiled('furniture'),
    ground: tiled('items'),
  };
}
