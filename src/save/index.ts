// W1 — Save, load, undo, backups (Part 4 §6–8, §10–11).
import type { CreationBuild, Bookmark, EnginePage, GameState, Head, LogLine, PageRef, StoryMeta, StoryOwner, TurnRecord, FameEntry } from '../types';
import type { Library } from '../types';
import { CONFIG } from '../config';
import { PAGE_LIMIT, byteLength, fromPages, hashPage, stableStringify, toPages, type Pages } from './pages';
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
/** Load refused: the save is untouched. The designer chooses one of `options`. */
export class LoadRefusedError extends Error {
  constructor(public report: string[], public options: ('undo' | 'safety' | 'reset')[]) {
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
  // GAP: versions are turns; a clash (undo engine page, a redo after restore) gets a fractional version like 40.001.
  for (let v = base; ; v = Math.round((v + 0.001) * 1000) / 1000) {
    const refs = live.map((b) => b.pages[key]).filter((r) => r && r.version === v);
    if (!refs.length) return { v, reuse: false };
    if (refs.every((r) => r.hash === hash)) return { v, reuse: true };
  }
}

/** Save step 3: write every page whose content changed; unchanged pages keep their old ref. The writes go out
 * together (each page is its own document; nothing points at them until the head is written). */
async function commitPages(store: Store, id: string, pages: Pages, base: number, live: Bookmark[], prev?: Record<string, PageRef>): Promise<Record<string, PageRef>> {
  const refs: Record<string, PageRef> = {};
  const writes: Promise<void>[] = [];
  for (const [key, page] of Object.entries(pages)) {
    const bytes = byteLength(page);
    if (bytes > PAGE_LIMIT) throw new SaveError('page_too_large', `page ${key} is ${bytes} bytes, over 256 KiB`);
    const hash = hashPage(page);
    if (prev?.[key]?.hash === hash) { refs[key] = prev[key]; continue; }
    const { v, reuse } = pickVersion(key, base, hash, live);
    if (!reuse) writes.push(store.set(pagePath(id, key, v), page));
    refs[key] = { version: v, hash, bytes };
  }
  await Promise.all(writes);
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
  throw new LoadRefusedError(reportLines(r), [...(h?.undo ? ['undo' as const] : []), ...(h?.safety ? ['safety' as const] : []), 'reset']);
};

// ---------- save ----------
/** Turn records past the budget lose their call inputs (views are rebuilt from the save); outputs stay for replay. */
function fitRecord(record: TurnRecord): TurnRecord {
  if (byteLength(record) <= PAGE_LIMIT) return record;
  // GAP: the spec sets no per-record budget beyond the page limit; inputs are dropped first
  const slim = { ...record, agentLog: record.agentLog.map(({ rawOutputs: _r, ...l }) => ({ ...l, input: '[trimmed: over 256 KiB]' })) };
  if (byteLength(slim) > PAGE_LIMIT) throw new SaveError('page_too_large', `turn record ${record.turn} is over 256 KiB`);
  return slim;
}

/** Save, once per turn (Part 4 §10). Writing control/head is the commit. The caller holds the turn lock. */
export async function saveTurn(store: Store, state: GameState, record: TurnRecord): Promise<Head> {
  const id = state.storyId;
  if (record.storyId !== id) throw new SaveError('wrong_story', `record is for ${record.storyId}, state is ${id}`);
  const pages = toPages(state);
  const head = await guard(async () => {
    const [prev, stored] = await Promise.all([store.get<Head>(headPath(id)), store.get(story(id))]);
    const live = prev ? [bookmarkOf(prev), ...(prev.undo ? [prev.undo] : []), ...(prev.safety ? [prev.safety] : [])] : [];
    const meta: StoryMeta = { ...state.meta, settings: state.settings };
    // pages, the turn record and the story meta are written together; the head (the commit) goes last
    const [refs] = await Promise.all([
      commitPages(store, id, pages, record.turn, live, prev?.pages),
      store.set(turnPath(id, record.turn), fitRecord(record)),
      stableStringify(stored) !== stableStringify(meta) ? store.set(story(id), meta) : undefined,
    ]);
    // safety (pre-migration or pre-restore) is dropped after this good turn
    const head: Head = { storyId: id, turn: record.turn, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: state.libraryVersion, undo: prev ? bookmarkOf(prev) : null };
    await store.set(headPath(id), head);
    return head;
  });
  await guard(async () => {
    await cleanup(store, id, head);
    if (record.turn > 0 && record.turn % CONFIG.BACKUP_EVERY === 0) await writeBackup(store, id, head, pages);
  }, true);
  return head;
}

/** Save step 6: drop page versions no bookmark points to, and turn records older than the last N. */
async function cleanup(store: Store, id: string, head: Head): Promise<void> {
  const keep = new Set([head, head.undo, head.safety].filter((b): b is Bookmark => !!b).flatMap((b) => Object.entries(b.pages).map(([k, r]) => pagePath(id, k, r.version))));
  const [pages, turns] = await Promise.all([store.list(`${story(id)}/pages`), store.list(`${story(id)}/turns`)]);
  await Promise.all([...pages.filter((p) => !keep.has(p)), ...turns.filter((p) => +tail(p) <= head.turn - CONFIG.TURN_RECORDS_KEPT)].map((p) => store.delete(p)));
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
    const live = [bookmarkOf(prev), ...(prev.undo ? [prev.undo] : []), ...(prev.safety ? [prev.safety] : [])];
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
    let safety = head.safety;
    if (head.schemaVersion < CONFIG.SCHEMA_VERSION) {
      await writeBackup(store, storyId, head); // on load before any migration (§11)
      safety = bookmarkOf(head);
    }
    prepare(pages, storyId, head.schemaVersion, library, r);
    if (r.errors.length) return refuse(r, head);
    let next = head;
    if (r.changed.size || head.libraryVersion !== library.version || safety !== head.safety) {
      const live = [bookmarkOf(head), ...(head.undo ? [head.undo] : []), ...(safety ? [safety] : [])];
      const refs = await commitPages(store, storyId, pages, head.turn, live, head.pages);
      // after a migration the undo bookmark holds old-schema pages: the safety bookmark replaces it
      const undo = head.schemaVersion < CONFIG.SCHEMA_VERSION ? null : head.undo;
      next = { ...head, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: library.version, undo, ...(safety ? { safety } : {}) };
      await store.set(headPath(storyId), next);
    }
    return { state: fromPages(meta, next, pages), report: [...r.repairs, ...r.warnings.map((w) => `warning: ${w}`)] };
  });
}

/** After a refused load, the designer picks the undo or safety bookmark: checked first, then made the head. */
export async function useBookmark(store: Store, storyId: string, which: 'undo' | 'safety', library: Library): Promise<{ state: GameState; report: string[] }> {
  await guard(async () => {
    const head = await store.get<Head>(headPath(storyId));
    const bm = head?.[which];
    const r = newReport();
    if (!head || !bm) { r.errors.push(`no ${which} bookmark`); return refuse(r, head); }
    const pages = await readPages(store, storyId, bm, r);
    // the safety bookmark predates a migration: its schema version is on the backup taken just before it
    const backup = which === 'safety' ? await store.get<{ schemaVersion: number }>(backupPath(storyId, bm.turn)) : null;
    const schemaVersion = backup?.schemaVersion ?? head.schemaVersion;
    if (!r.errors.length) prepare(pages, storyId, schemaVersion, library, r);
    if (r.errors.length) return refuse(r, head);
    await store.set(headPath(storyId), { ...head, ...bm, schemaVersion, undo: null, safety: which === 'undo' ? head.safety : undefined } satisfies Head);
  });
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
    const live = [bookmarkOf(head), head.undo, ...(head.safety ? [head.safety] : [])];
    const refs = await commitPages(store, storyId, { engine }, head.undo.turn, live);
    const next: Head = { ...head, turn: head.undo.turn, pages: { ...head.undo.pages, ...refs }, undo: null };
    await store.set(headPath(storyId), next);
    await store.delete(turnPath(storyId, head.turn));
    await cleanup(store, storyId, next);
  });
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
 * A chunk over 256 KiB drops its lines' code-built extras (mechanics, speech, changes), keeping the text.
 */
export async function saveHistory(store: Store, storyId: string, lines: LogLine[], fromIndex: number): Promise<void> {
  const chunks = [...new Set(lines.slice(fromIndex).map((l) => historyChunk(l.turn)))];
  for (const n of chunks) {
    let doc: HistoryDoc = { storyId, chunk: n, lines: lines.filter((l) => historyChunk(l.turn) === n) };
    if (byteLength(doc) > PAGE_LIMIT) doc = { ...doc, lines: doc.lines.map(({ turn, kind, text }) => ({ turn, kind, text })) };
    if (byteLength(doc) > PAGE_LIMIT) throw new SaveError('page_too_large', `story text for chunk ${n} is over 256 KiB`, true);
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
/** Every story's meta, newest first. A confirmed reset starts a new story id and archives the old story's pages under its own id (D-73). */
export async function listStories(store: Store): Promise<StoryMeta[]> {
  const metas = await Promise.all((await store.list('stories')).map((p) => store.get<StoryMeta>(p)));
  // GAP: no "current story" pointer in the spec's paths; the newest createdAt is the one that runs
  return metas.filter((m): m is StoryMeta => !!m && !m.archivedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.storyId.localeCompare(a.storyId));
}

const allMetas = async (store: Store) => (await Promise.all((await store.list('stories')).map((p) => store.get<StoryMeta>(p)))).filter((m): m is StoryMeta => !!m);
export const worldOf = (m: StoryMeta): string => m.worldId ?? m.storyId;

/** HF31: a world a new character can carry on: its newest story is archived and its character fell there (no one lives
 * in it). name: after the first character who fell there; day: the day the last one fell; fell: everyone who fell there, first first. */
export type FreeWorld = { worldId: string; name: string; lastStoryId: string; day: number; fell: string[] };
async function freeWorlds(store: Store, owner: StoryOwner): Promise<(FreeWorld & { at: string })[]> {
  const byWorld = new Map<string, StoryMeta[]>();
  for (const m of await allMetas(store)) if ((m.owner ?? 'player') === owner) byWorld.set(worldOf(m), [...(byWorld.get(worldOf(m)) ?? []), m]);
  const free: (FreeWorld & { at: string })[] = [];
  for (const [worldId, ms] of byWorld) {
    if (ms.some((m) => !m.archivedAt)) continue; // someone lives there
    const fallen = ms.flatMap((m) => (m.fame ? [m.fame] : [])).sort((a, b) => a.fellAt.localeCompare(b.fellAt));
    const last = ms.reduce((a, b) => (b.archivedAt! > a.archivedAt! ? b : a));
    if (!last.fame) continue;
    free.push({ worldId, name: `${fallen[0].name}’s world`, lastStoryId: last.storyId, day: last.fame.day, fell: fallen.map((f) => f.name), at: last.archivedAt! });
  }
  return free;
}
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
export async function archiveStory(store: Store, storyId: string, at: string, fame?: FameEntry): Promise<void> {
  const meta = await guard(() => store.get<StoryMeta>(story(storyId)));
  if (meta) await guard(() => store.set(story(storyId), { ...meta, archivedAt: at, ...(fame ? { fame } : {}) }));
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

/** Restore runs the same checks as a load, writes a new head on the backup's pages and keeps the current head as safety. */
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
    const live = head ? [bookmarkOf(head), ...(head.undo ? [head.undo] : []), ...(head.safety ? [head.safety] : [])] : [];
    const refs = await commitPages(store, storyId, pages, turn, live);
    await store.set(headPath(storyId), {
      storyId, turn, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: library.version, undo: null,
      ...(head ? { safety: bookmarkOf(head) } : {}),
    } satisfies Head);
  });
  return loadStory(store, storyId, library);
}
