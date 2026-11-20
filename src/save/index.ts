// W1 — Save, load, undo, backups (Part 4 §6–8, §10–11).
import type { CreationBuild, Bookmark, EnginePage, GameState, Head, Library, LogLine, PageRef, StoryMeta, StoryOwner, TurnRecord, FameEntry } from '../types';
import { CONFIG } from '../config';
import { PAGE_LIMIT, byteLength, fromPages, hashPage, stableStringify, toPages, type Pages } from './pages';
import { brokenLayouts } from '../scenario/geometry';
import { roofed } from '../plan/where';
import { worldCheck } from '../scenario/ways';
import { checkInvariants, checkShape, migrate, newReport, reconcile, repairReferences, type CheckReport } from './checks';
export { memoryStore, artifactDbStore, type MemoryStore, type DB } from './store';
export { universeDay, reachDay } from './universe';
export { carryOn, pastCharacterId } from './world';
export { MIGRATIONS } from './checks';
export { hashPage, stableStringify, toPages, fromPages } from './pages';

/** the artifact database, or an in-memory fake for tests. Paths have an even segment count. */
export interface Store {
  get<T = unknown>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  delete(path: string): Promise<void>;
  /** full paths of the documents directly in the collection `prefix` (odd segment count) */
  list(prefix: string): Promise<string[]>;
  /** single-writer lease; returns false when held by another window */
  acquireLease(path: string, owner: string, ms: number): Promise<boolean>;
  releaseLease(path: string, owner: string): Promise<void>;
}

/** quota_exceeded, page_too_large, no_save, nothing_to_undo, ... `committed`: the head was already written. */
export class SaveError extends Error {
  constructor(public code: string, message: string, public committed = false) {
    super(message);
  }
}
/** Load refused: the save is untouched. `canGoBack`: the head has an undo bookmark to go back one turn to (YS1 c). */
export class LoadRefusedError extends Error {
  constructor(public report: string[], public canGoBack: boolean) {
    super(`load refused: ${report[0] ?? ''}`);
  }
}

// ---------- paths ----------
const story = (id: string) => `stories/${id}`;
const headPath = (id: string) => `${story(id)}/control/head`;
export const lockPath = (id: string) => `${story(id)}/control/lock`;
const pagePath = (id: string, key: string, v: number) => `${story(id)}/pages/${key}@${v}`;
const turnPath = (id: string, t: number) => `${story(id)}/turns/${t}`;
const backupPath = (id: string, t: number) => `${story(id)}/backups/${t}`;
const historyPath = (id: string, n: number) => `${story(id)}/history/${n}`;
const tail = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const bookmarkOf = (h: Head): Bookmark => ({ turn: h.turn, pages: h.pages });
/** the bookmarks whose pages must not be overwritten: the head and its undo */
const liveOf = (h: Head | null): Bookmark[] => (h ? [bookmarkOf(h), ...(h.undo ? [h.undo] : [])] : []);
/** the page limit as the save's messages say it */
const LIMIT_TEXT = `${PAGE_LIMIT / 1024} KiB`;

async function guard<T>(fn: () => Promise<T>, committed = false): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SaveError || e instanceof LoadRefusedError) throw e;
    const code = (e as { code?: string })?.code ?? 'store_error';
    const msg = code === 'quota_exceeded' ? 'The save is full: this turn was not saved, and the last good save is kept.' : String((e as Error)?.message ?? e);
    throw new SaveError(code, msg, committed);
  }
}

// ---------- page versions ----------
/** A path some live bookmark points to is never overwritten with other content: bump the version instead. */
function pickVersion(key: string, base: number, hash: string, live: Bookmark[]): { v: number; reuse: boolean } {
  // versions are turns; a clash (undo engine page, a redo after restore) gets a fractional version like 40.001.
  for (let v = base; ; v = Math.round((v + 0.001) * 1000) / 1000) {
    const refs = live.map((b) => b.pages[key]).filter((r) => r && r.version === v);
    if (!refs.length) return { v, reuse: false };
    if (refs.every((r) => r.hash === hash)) return { v, reuse: true };
  }
}

/** Save step 3: every page whose content changed gets a new ref and is written; unchanged pages keep their old ref.
 * `write` sends the writes together (each page is its own document; nothing points at them until the head is written). */
function planPages(store: Store, id: string, pages: Pages, base: number, live: Bookmark[], prev?: Record<string, PageRef>) {
  const refs: Record<string, PageRef> = {};
  const writes: [string, unknown][] = [];
  for (const [key, page] of Object.entries(pages)) {
    const bytes = byteLength(page);
    if (bytes > PAGE_LIMIT) throw new SaveError('page_too_large', `page ${key} is ${bytes} bytes, over ${LIMIT_TEXT}`);
    const hash = hashPage(page);
    if (prev?.[key]?.hash === hash) { refs[key] = prev[key]; continue; }
    const { v, reuse } = pickVersion(key, base, hash, live);
    if (!reuse) writes.push([pagePath(id, key, v), page]);
    refs[key] = { version: v, hash, bytes };
  }
  return { refs, write: () => Promise.all(writes.map(([path, page]) => store.set(path, page))) };
}
async function commitPages(...args: Parameters<typeof planPages>): Promise<Record<string, PageRef>> {
  const { refs, write } = planPages(...args);
  await write();
  return refs;
}

async function readPages(store: Store, id: string, bm: Bookmark, r: CheckReport): Promise<Pages> {
  const pages: Pages = {};
  const entries = Object.entries(bm.pages);
  const got = await Promise.all(entries.map(([key, ref]) => store.get(pagePath(id, key, ref.version)))); // read together
  for (const [i, [key, ref]] of entries.entries()) {
    const page = got[i];
    if (page === null) r.errors.push(`checksum: page ${key}@${ref.version} missing`);
    else if (hashPage(page) !== ref.hash) r.errors.push(`checksum: page ${key}@${ref.version} does not match the head`);
    else pages[key] = page;
  }
  return pages;
}

/** Load steps 2–4 in memory: migrations, reconcile, shape, invariants, references. */
function prepare(pages: Pages, id: string, schemaVersion: number, library: Library, r: CheckReport): void {
  if (!migrate(pages, schemaVersion, CONFIG.SCHEMA_VERSION, r)) return;
  checkShape(pages, r);
  if (r.errors.length) return;
  reconcile(pages, library, r);
  checkInvariants(pages, id, library, r);
  repairReferences(pages, library, r);
}

const reportLines = (r: CheckReport) => [...r.errors, ...r.repairs, ...r.warnings.map((w) => `warning: ${w}`)];
const refuse = (r: CheckReport, h: Head | null): never => {
  throw new LoadRefusedError(reportLines(r), !!h?.undo);
};

// ---------- save ----------
/** Turn records past the budget lose their call inputs (views are rebuilt from the save); outputs stay for replay. */
function fitRecord(record: TurnRecord): TurnRecord {
  if (byteLength(record) <= PAGE_LIMIT) return record;
  // no per-record budget beyond the page limit: inputs are dropped first
  const slim = { ...record, agentLog: record.agentLog.map(({ rawOutputs: _r, ...l }) => ({ ...l, input: `[trimmed: over ${LIMIT_TEXT}]` })) };
  if (byteLength(slim) > PAGE_LIMIT) throw new SaveError('page_too_large', `turn record ${record.turn} is over ${LIMIT_TEXT}`);
  return slim;
}

/** Save, once per turn (Part 4 §10). Writing control/head is the commit. The caller holds the turn lock. */
export async function saveTurn(store: Store, state: GameState, record: TurnRecord): Promise<Head> {
  const id = state.storyId;
  if (record.storyId !== id) throw new SaveError('wrong_story', `record is for ${record.storyId}, state is ${id}`);
  const pages = toPages(state);
  const { head, prev } = await guard(async () => {
    const [prev, stored] = await Promise.all([store.get<Head>(headPath(id)), store.get(story(id))]);
    const live = liveOf(prev);
    const meta: StoryMeta = { ...state.meta, settings: state.settings };
    const { refs, write } = planPages(store, id, pages, record.turn, live, prev?.pages);
    const head: Head = { storyId: id, turn: record.turn, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: state.libraryVersion, undo: prev ? bookmarkOf(prev) : null };
    checkHeadSize(state, head, prev);
    // pages, the turn record and the story meta are written together; the head (the commit) goes last
    await Promise.all([
      write(),
      store.set(turnPath(id, record.turn), fitRecord(record)),
      stableStringify(stored) !== stableStringify(meta) ? store.set(story(id), meta) : undefined,
    ]);
    await store.set(headPath(id), head);
    return { head, prev };
  });
  await guard(async () => {
    const backupTurn = record.turn % CONFIG.BACKUP_EVERY === 0;
    await cleanup(store, id, head, backupTurn ? undefined : prev);
    if (record.turn > 0 && backupTurn) await writeBackup(store, id, head, pages);
  }, true);
  return head;
}

/** The head lists every page twice (its own map and the undo bookmark), so it is the one document that grows with the
 * world. Past the document limit the save is refused before anything is written; past HEAD_WARN_SHARE of it the turn
 * logs head_large once, as the head crosses that line, so a build thread hears of it long before saves stop. */
function checkHeadSize(state: GameState, head: Head, prev: Head | null): void {
  const bytes = byteLength(head), warn = CONFIG.HEAD_WARN_SHARE * PAGE_LIMIT;
  if (bytes > PAGE_LIMIT) throw new SaveError('page_too_large', `the save's head lists ${Object.keys(head.pages).length} pages and is ${bytes} bytes, over ${LIMIT_TEXT}`);
  if (bytes >= warn && (!prev || byteLength(prev) < warn)) state.log.push({ turn: head.turn, code: 'head_large', detail: { bytes, pages: Object.keys(head.pages).length } });
}

/** Save step 6: drop page versions no bookmark points to, and turn records older than the last N. An ordinary turn
 * works them out from `prev`, the head it replaced: the versions only its bookmarks held, and the one record that just
 * fell out of the last N. With no `prev` it lists both collections and sweeps them, which also takes what a failed
 * write left behind (BACKUP_EVERY turns, undo, restore). */
async function cleanup(store: Store, id: string, head: Head, prev?: Head | null): Promise<void> {
  const paths = (h: Head | null) => liveOf(h).flatMap((b) => Object.entries(b.pages).map(([k, r]) => pagePath(id, k, r.version)));
  const keep = new Set(paths(head));
  const old = head.turn - CONFIG.TURN_RECORDS_KEPT;
  const [pages, turns] = prev === undefined
    ? await Promise.all([store.list(`${story(id)}/pages`), store.list(`${story(id)}/turns`)])
    : [[...new Set(paths(prev))], old >= 0 ? [turnPath(id, old)] : []];
  await Promise.all([...pages.filter((p) => !keep.has(p)), ...turns.filter((p) => +tail(p) <= old)].map((p) => store.delete(p)));
}

/** CS12: a change made between turns (a perk taken or undone, a quest abandoned or pinned) saved at once. The saved head's
 * state is loaded, `change` is applied to it, and its pages are written as the same turn: no new turn, no turn record,
 * and the undo bookmark stays where it was. The caller holds the turn lock. */
export async function amendHead(store: Store, storyId: string, library: Library, change: (state: GameState) => void): Promise<void> {
  const { state } = await loadStory(store, storyId, library);
  change(state);
  const pages = toPages(state);
  await guard(async () => {
    const prev = await store.get<Head>(headPath(storyId));
    if (!prev) throw new SaveError('no_head', `story ${storyId} has no saved turn to amend`);
    const live = liveOf(prev);
    const refs = await commitPages(store, storyId, pages, prev.turn, live, prev.pages);
    await store.set(headPath(storyId), { ...prev, pages: refs } satisfies Head);
  });
}

// ---------- load ----------
/** Load: checksums, migrations, library reconcile, invariants, references; then build GameState. Throws LoadRefusedError. */
export async function loadStory(store: Store, storyId: string, library: Library): Promise<{ state: GameState; report: string[] }> {
  return guard(async () => {
    const r = newReport();
    const [head, meta] = await Promise.all([store.get<Head>(headPath(storyId)), store.get<StoryMeta>(story(storyId))]);
    if (!head || !meta) { r.errors.push('no save for this story'); return refuse(r, head); }
    const pages = await readPages(store, storyId, head, r);
    if (r.errors.length) return refuse(r, head);
    const migrating = head.schemaVersion < CONFIG.SCHEMA_VERSION;
    if (migrating) await writeBackup(store, storyId, head); // on load before any migration (§11)
    prepare(pages, storyId, head.schemaVersion, library, r);
    if (r.errors.length) return refuse(r, head);
    let next = head;
    if (r.changed.size || head.libraryVersion !== library.version || migrating) {
      const refs = await commitPages(store, storyId, pages, head.turn, liveOf(head), head.pages);
      // after a migration the undo bookmark holds old-schema pages: the backup just written stands in for it
      next = { ...head, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: library.version, undo: migrating ? null : head.undo };
      await store.set(headPath(storyId), next);
    }
    const state = fromPages(meta, next, pages);
    // MR2: a layout stored before the map rules (MAP-10/11/12) is placed again once; the next save keeps the new one
    // WI9 a: a land rule the save still breaks is filed as a bug (once per rule broken), and the game loads anyway
    for (const m of worldCheck(state)) {
      r.warnings.push(`world check: ${m}`);
      if (!state.log.some((l) => l.code === 'world_check' && l.detail?.broken === m)) state.log.push({ turn: state.turn, code: 'world_check', detail: { broken: m } });
    }
    for (const b of brokenLayouts(state, (z) => roofed(state, z))) r.warnings.push(`map: ${b.placeId} ${b.why}`);
    return { state, report: [...r.repairs, ...r.warnings.map((w) => `warning: ${w}`)] };
  });
}

/** YS1 c: after a refused load, go back one turn: the undo bookmark is checked like a load, then made the head. Unlike
 * /undo it never reads the refused turn's pages, which may be the ones that are broken. */
export async function goBackOneTurn(store: Store, storyId: string, library: Library): Promise<{ state: GameState; report: string[] }> {
  await guard(async () => {
    const head = await store.get<Head>(headPath(storyId));
    const r = newReport();
    if (!head?.undo) { r.errors.push('no turn to go back to'); return refuse(r, head); }
    const pages = await readPages(store, storyId, head.undo, r);
    if (!r.errors.length) prepare(pages, storyId, head.schemaVersion, library, r);
    if (r.errors.length) return refuse(r, null);
    const next: Head = { storyId, turn: head.undo.turn, pages: head.undo.pages, schemaVersion: head.schemaVersion, libraryVersion: head.libraryVersion, undo: null };
    await store.set(headPath(storyId), next);
    return next;
  }).then((next) => guard(() => cleanup(store, storyId, next), true)); // the refused turn's pages go
  return loadStory(store, storyId, library);
}

// ---------- undo ----------
/** Undo one turn: head back to the undo bookmark; RNG state carried forward (not rolled back). Caller holds the turn lock. */
export async function undoTurn(store: Store, storyId: string): Promise<void> {
  await guard(async () => {
    const head = await store.get<Head>(headPath(storyId));
    if (!head) throw new SaveError('no_save', 'no save to undo');
    if (!head.undo) throw new SaveError('nothing_to_undo', 'undo goes back one turn only'); // D-72
    const r = newReport();
    const cur = await readPages(store, storyId, { turn: head.turn, pages: { engine: head.pages.engine } }, r);
    const back = await readPages(store, storyId, { turn: head.undo.turn, pages: { engine: head.undo.pages.engine } }, r);
    if (r.errors.length) throw new SaveError('checksum', r.errors.join('; '));
    const engine: EnginePage = { ...(back.engine as EnginePage), rngState: (cur.engine as EnginePage).rngState };
    const refs = await commitPages(store, storyId, { engine }, head.undo.turn, liveOf(head));
    const next: Head = { ...head, turn: head.undo.turn, pages: { ...head.undo.pages, ...refs }, undo: null };
    await store.set(headPath(storyId), next);
    return { next, undone: head.turn };
  }).then(({ next, undone }) => guard(async () => { // BG-338: the head is written, so the undo is done whatever fails now
    await store.delete(turnPath(storyId, undone));
    await cleanup(store, storyId, next);
  }, true));
}

export async function readTurnRecord(store: Store, storyId: string, turn: number): Promise<TurnRecord | null> {
  return guard(() => store.get<TurnRecord>(turnPath(storyId, turn)));
}

// ---------- story text (Q18) ----------
type HistoryDoc = { storyId: string; chunk: number; lines: LogLine[] };
export const historyChunk = (turn: number) => Math.floor(Math.max(0, turn) / CONFIG.HISTORY_CHUNK_TURNS);

/**
 * Save the story column: every chunk that the new lines touch is rewritten whole from `lines` (chunk n holds turns
 * n×HISTORY_CHUNK_TURNS onward). Not part of the turn commit: a failure loses only text, never game state.
 * A chunk over the page limit drops its lines' code-built extras (mechanics, speech, changes), keeping the text.
 */
export async function saveHistory(store: Store, storyId: string, lines: LogLine[], fromIndex: number): Promise<void> {
  const chunks = [...new Set(lines.slice(fromIndex).map((l) => historyChunk(l.turn)))];
  for (const n of chunks) {
    let doc: HistoryDoc = { storyId, chunk: n, lines: lines.filter((l) => historyChunk(l.turn) === n) };
    if (byteLength(doc) > PAGE_LIMIT) doc = { ...doc, lines: doc.lines.map(({ turn, kind, text }) => ({ turn, kind, text })) };
    if (byteLength(doc) > PAGE_LIMIT) throw new SaveError('page_too_large', `story text for chunk ${n} is over ${LIMIT_TEXT}`, true);
    await guard(() => store.set(historyPath(storyId, n), doc), true);
  }
}

/** BG-161: a restored backup drops the story text of the turns after it: later chunks go, the cut chunk keeps its earlier lines. */
export async function cutHistory(store: Store, storyId: string, afterTurn: number): Promise<void> {
  const keep = historyChunk(afterTurn);
  for (const p of await guard(() => store.list(`${story(storyId)}/history`))) {
    const n = +tail(p);
    if (n > keep) await guard(() => store.delete(p), true);
    else if (n === keep) {
      const doc = await guard(() => store.get<HistoryDoc>(p));
      if (doc) await guard(() => store.set(p, { ...doc, lines: doc.lines.filter((l) => l.turn <= afterTurn) }), true);
    }
  }
}

/** The whole saved story column, oldest first. */
export async function loadHistory(store: Store, storyId: string): Promise<LogLine[]> {
  const paths = (await guard(() => store.list(`${story(storyId)}/history`))).sort((a, b) => +tail(a) - +tail(b));
  const docs = await Promise.all(paths.map((p) => guard(() => store.get<HistoryDoc>(p))));
  return docs.flatMap((d) => d?.lines ?? []);
}

// ---------- turn lock ----------
export const acquireTurnLock = (store: Store, storyId: string, owner: string) => store.acquireLease(lockPath(storyId), owner, CONFIG.LOCK_LEASE_MS);
export const releaseTurnLock = (store: Store, storyId: string, owner: string) => store.releaseLease(lockPath(storyId), owner);

// ---------- stories ----------
/** BG-336: the meta is written with the pages, before the head, so a story whose first head write failed has a meta and no
 * save: it does not exist yet (a save counts once the head is written). Only unarchived stories need the look. */
const allMetas = async (store: Store) => (await Promise.all((await store.list('stories')).map(async (p) => {
  const m = await store.get<StoryMeta>(p);
  return m && (m.archivedAt || (await store.get(headPath(m.storyId)))) ? m : null;
}))).filter((m): m is StoryMeta => !!m);
/** Every story's meta, newest first. A confirmed reset starts a new story id and archives the old story's pages under its own id (D-73). */
export async function listStories(store: Store): Promise<StoryMeta[]> {
  // no "current story" pointer: the newest createdAt is the one that runs
  return (await allMetas(store)).filter((m) => !m.archivedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.storyId.localeCompare(a.storyId));
}

export const worldOf = (m: StoryMeta): string => m.worldId ?? m.storyId;

/** HF31: a world a new character can carry on: every story in it is archived, so no one lives there (WP1 b: a character
 * reset while standing left it for good). name: the title given in the game (WP5), else after its first character;
 * day: the day the last one's story ended; past: everyone who lived there, first first; threadbound: Threadbound items
 * lying in it (WP2 b). */
export type FreeWorld = { worldId: string; name: string; lastStoryId: string; day: number; past: { name: string; fell: boolean }[]; threadbound: string[] };
const worldTitle = (worldId: string) => `worlds/${worldId}`;
async function freeWorlds(store: Store, owner: StoryOwner): Promise<(FreeWorld & { at: string })[]> {
  const byWorld = new Map<string, StoryMeta[]>();
  for (const m of await allMetas(store)) if ((m.owner ?? 'player') === owner) byWorld.set(worldOf(m), [...(byWorld.get(worldOf(m)) ?? []), m]);
  const free: (FreeWorld & { at: string })[] = [];
  for (const [worldId, ms] of byWorld) {
    if (ms.some((m) => !m.archivedAt || !m.end)) continue; // someone lives there (a story with no ending predates them and is too old to carry on anyway)
    ms.sort((a, b) => a.archivedAt!.localeCompare(b.archivedAt!));
    const last = ms.at(-1)!, title = await store.get<{ name: string }>(worldTitle(worldId));
    if ((last.schemaVersion ?? 0) < CONFIG.OLDEST_SAVE_SCHEMA) continue; // a world too old to load ends with its saves
    free.push({ worldId, name: title?.name || `${ms[0].end!.name}’s world`, lastStoryId: last.storyId, day: last.end!.day,
      past: ms.map((m) => ({ name: m.end!.name, fell: !!m.fame })), threadbound: last.end!.threadbound, at: last.archivedAt! });
  }
  return free;
}
/** WP5: a world's title, given in the game; an empty one goes back to the default */
export const titleWorld = (store: Store, worldId: string, name: string) =>
  guard(() => (name.trim() ? store.set(worldTitle(worldId), { name: name.trim().slice(0, CONFIG.WORLD_TITLE_CAP) }) : store.delete(worldTitle(worldId))));
/** the creation screen's list, newest fall first; a world a character is already arriving in is left out */
export async function listWorlds(store: Store, owner: StoryOwner = 'player'): Promise<FreeWorld[]> {
  const arriving = (await store.get<PendingStart>(pendingPath(owner)))?.worldId;
  return (await freeWorlds(store, owner)).filter((w) => w.worldId !== arriving).sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _a, ...w }) => w);
}
/** the free world `worldId`, the one a pending start is arriving in included */
export const freeWorld = async (store: Store, worldId: string, owner: StoryOwner = 'player'): Promise<FreeWorld | undefined> =>
  (await freeWorlds(store, owner)).find((w) => w.worldId === worldId);

/** Hall of fame: every archived story whose character fell, with its owner, newest fall first. */
export async function listFallen(store: Store): Promise<(FameEntry & { owner: StoryOwner; storyId: string })[]> {
  return (await allMetas(store)).flatMap((m) => (m.fame ? [{ ...m.fame, owner: m.owner ?? 'player', storyId: m.storyId }] : []))
    .sort((a, b) => b.fellAt.localeCompare(a.fellAt));
}

/** A confirmed reset (D-73: the GM can reset the save): the story is archived, not deleted. Its meta is
 * marked, so listStories (and so resume) skips it, and a story still starting is dropped too. */
export async function archiveStory(store: Store, storyId: string, at: string, fame?: FameEntry, end?: StoryMeta['end']): Promise<void> {
  const meta = await guard(() => store.get<StoryMeta>(story(storyId)));
  if (meta) await guard(() => store.set(story(storyId), { ...meta, archivedAt: at, ...(fame ? { fame } : {}), ...(end ? { end } : {}) }));
  for (const owner of ['player', 'agent'] as const) {
    const pending = await guard(() => store.get<PendingStart>(pendingPath(owner))).catch(() => null);
    if (pending?.storyId === storyId) await guard(() => store.delete(pendingPath(owner)));
  }
}

// ---------- a story still starting ----------
/** Closing the game during turn 0 lost the new story, because nothing is saved until the opening
 * scenario is planned and narrated. The build is written first; resume finds it and starts the opening again. */
export type PendingStart = { storyId: string; build: CreationBuild; at: string; owner?: StoryOwner; worldId?: string };
const PENDING_START = 'pending/start';
/** one pending start per owner: the player's, and the autopilot agent's own save */
const pendingPath = (owner: StoryOwner = 'player') => (owner === 'agent' ? 'pending/agent' : PENDING_START);
export const savePendingStart = (store: Store, p: PendingStart) => guard(() => store.set(pendingPath(p.owner), p));
export const loadPendingStart = (store: Store, owner?: StoryOwner) => guard(() => store.get<PendingStart>(pendingPath(owner)));
export const clearPendingStart = (store: Store, owner?: StoryOwner) => guard(() => store.delete(pendingPath(owner)));
/** has this story's first turn been saved (a head exists)? */
export const storySaved = async (store: Store, storyId: string) => !!(await guard(() => store.get(headPath(storyId))));

// ---------- backups (§11) ----------
type BackupDoc = { storyId: string; turn: number; schemaVersion: number; libraryVersion: number; refs: Record<string, PageRef>; parts: number; pages: Pages };

/** Every page the head lists, packed into as few documents as fit: backups/<turn>, then backups/<turn>/parts/<n>.
 * `inMemory`: the pages just saved under this head, so they need not be read back. */
export async function writeBackup(store: Store, storyId: string, head: Head, inMemory?: Pages): Promise<void> {
  const r = newReport();
  const pages = inMemory && Object.keys(head.pages).every((k) => k in inMemory && hashPage(inMemory[k]) === head.pages[k].hash) ? inMemory : await readPages(store, storyId, head, r);
  if (r.errors.length) throw new SaveError('checksum', r.errors.join('; '));
  const envelope = { storyId, turn: head.turn, schemaVersion: head.schemaVersion, libraryVersion: head.libraryVersion, refs: head.pages, parts: 0 };
  const chunks: Pages[] = [{}];
  let size = byteLength(envelope) + 64;
  for (const [key, page] of Object.entries(pages)) {
    const b = byteLength(page) + key.length + 8;
    if (size + b > PAGE_LIMIT && Object.keys(chunks[chunks.length - 1]).length) { chunks.push({}); size = 64; }
    chunks[chunks.length - 1][key] = page;
    size += b;
  }
  const base = backupPath(storyId, head.turn);
  await Promise.all(chunks.slice(1).map((c, i) => store.set(`${base}/parts/${i + 1}`, { pages: c })));
  await store.set(base, { ...envelope, parts: chunks.length - 1, pages: chunks[0] } satisfies BackupDoc);
  const all = (await store.list(`${story(storyId)}/backups`)).sort((a, b) => +tail(b) - +tail(a));
  await Promise.all(all.slice(CONFIG.BACKUPS_KEPT).map((p) => deleteBackup(store, p)));
}

async function deleteBackup(store: Store, path: string): Promise<void> {
  await Promise.all((await store.list(`${path}/parts`)).map((p) => store.delete(p)));
  await store.delete(path);
}

/** For the GM view, newest first. */
export async function listBackups(store: Store, storyId: string): Promise<{ turn: number; path: string }[]> {
  return (await store.list(`${story(storyId)}/backups`)).map((path) => ({ turn: +tail(path), path })).sort((a, b) => b.turn - a.turn);
}

/** Restore runs the same checks as a load and writes a new head on the backup's pages. The save it replaces is backed up
 * first, as before a migration (YS1 c), unless its pages no longer read back (a refused load's broken turn). */
export async function restoreBackup(store: Store, storyId: string, turn: number, library: Library): Promise<{ state: GameState; report: string[] }> {
  await guard(async () => {
    const r = newReport();
    const head = await store.get<Head>(headPath(storyId));
    const doc = await store.get<BackupDoc>(backupPath(storyId, turn));
    if (!doc) { r.errors.push(`no backup at turn ${turn}`); return refuse(r, head); }
    const pages: Pages = { ...doc.pages };
    const parts = await Promise.all(Array.from({ length: doc.parts }, (_, i) => store.get<{ pages: Pages }>(`${backupPath(storyId, turn)}/parts/${i + 1}`)));
    for (const x of parts) Object.assign(pages, x?.pages ?? {});
    for (const [key, ref] of Object.entries(doc.refs)) {
      if (!(key in pages)) r.errors.push(`checksum: backup page ${key} missing`);
      else if (hashPage(pages[key]) !== ref.hash) r.errors.push(`checksum: backup page ${key} does not match`);
    }
    if (!r.errors.length) prepare(pages, storyId, doc.schemaVersion, library, r);
    if (r.errors.length) return refuse(r, head);
    // the same turn's backup would be overwritten by the save it is about to replace
    if (head && head.turn !== turn) await writeBackup(store, storyId, head).catch((e) => { if (!(e instanceof SaveError && e.code === 'checksum')) throw e; });
    const refs = await commitPages(store, storyId, pages, turn, liveOf(head));
    const next: Head = { storyId, turn, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: library.version, undo: null };
    await store.set(headPath(storyId), next);
    return next;
  }).then((next) => guard(() => cleanup(store, storyId, next), true)); // the replaced save is in its backup now
  return loadStory(store, storyId, library);
}
