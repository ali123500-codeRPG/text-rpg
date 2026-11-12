// GameState <-> saved pages (Part 4 §6, §9), stable hashing and size budgets.
import type { Actor, BlueprintPage, EnginePage, FactsPage, GameState, Head, HiddenPage, Place, StoryFact, StoryMeta } from '../types';

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

/** Every page of the story, keyed by page key. Copies: the state is never shared with the store. */
export function toPages(state: GameState): Pages {
  const s = structuredClone(state);
  const engine: EnginePage = {
    storyId: s.storyId, turn: s.turn, mode: s.mode, rngSeed: s.rngSeed, rngState: s.rngState, pending: s.pending,
    stage: s.stage, sceneCaps: s.sceneCaps, clocks: s.clocks, flags: s.flags, bands: s.bands, quests: s.quests,
    ...(s.recentEvents?.length ? { recentEvents: s.recentEvents } : {}),
    ...(s.spars?.length ? { spars: s.spars } : {}),
    ...(s.yielding ? { yielding: s.yielding } : {}),
    ...(s.barriers && Object.keys(s.barriers).length ? { barriers: s.barriers } : {}),
    order: { actors: [s.player, ...s.actors].map((a) => a.id), places: s.places.map((p) => p.id) },
  };
  const hidden: HiddenPage = { storyId: s.storyId, ...s.hidden };
  const pages: Pages = { engine, hidden };
  for (const a of [s.player, ...s.actors]) pages[`actor.${a.id}`] = a;
  for (const p of s.places) pages[`place.${p.id}`] = p;
  const byPlace = new Map<string, StoryFact[]>();
  for (const f of s.facts) byPlace.set(f.placeId, [...(byPlace.get(f.placeId) ?? []), f]);
  for (const [placeId, facts] of byPlace) factsPages(s.storyId, placeId, facts).forEach((fp, n) => (pages[`facts.${placeId}.${n}`] = fp));
  for (const b of s.blueprints) pages[`blueprint.${b.id}`] = b;
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
  const actors = orderBy(of<Actor>('actor.'), engine.order?.actors);
  const places = orderBy(of<Place>('place.'), engine.order?.places);
  const factKeys = Object.keys(p).filter((k) => k.startsWith('facts.'))
    .sort((a, b) => { const na = +a.slice(a.lastIndexOf('.') + 1), nb = +b.slice(b.lastIndexOf('.') + 1); return a.slice(0, a.lastIndexOf('.')).localeCompare(b.slice(0, b.lastIndexOf('.'))) || na - nb; });
  // shortcut: facts come back grouped by place then sorted by turn (stable), which is chronological per place
  const facts = factKeys.flatMap((k) => (p[k] as FactsPage).facts).map((f, i) => [f, i] as const)
    .sort((a, b) => a[0].turn - b[0].turn || a[1] - b[1]).map(([f]) => f);
  const zoneById = new Map(places.flatMap((pl) => pl.zones.map((z) => [z.id, z] as const)));
  const player = actors.find((a) => a.kind === 'player')!;
  const { order: _o, storyId: _e, turn, mode, rngSeed, rngState, pending, stage, sceneCaps, clocks, flags, bands, quests, recentEvents, spars, yielding, barriers } = engine;
  return {
    storyId: meta.storyId, turn, mode,
    zones: stage.zoneIds.map((id) => zoneById.get(id)!).filter(Boolean),
    player, actors: actors.filter((a) => a !== player), bands,
    hidden, events: [], agentLog: [], log: [], ...(recentEvents ? { recentEvents } : {}), ...(spars?.length ? { spars } : {}), ...(yielding ? { yielding } : {}), ...(barriers ? { barriers } : {}),
    rngSeed, rngState, pending, places, facts, stage, sceneCaps, clocks, flags, quests,
    settings: structuredClone(meta.settings), libraryVersion: head.libraryVersion,
    blueprints: of<BlueprintPage>('blueprint.'), meta: structuredClone(meta),
  };
}
