// W1 — Save, load, undo, backups (Part 4 §6–8, §10–11).
import type { CreationBuild, Bookmark, EnginePage, GameState, Head, LogLine, PageRef, StoryMeta, TurnRecord } from '../types';
import type { Library } from '../types';
import { CONFIG } from '../config';
import { PAGE_LIMIT, byteLength, fromPages, hashPage, stableStringify, toPages, type Pages } from './pages';
import { checkInvariants, checkShape, migrate, newReport, reconcile, repairReferences, type CheckReport } from './checks';
export { memoryStore, artifactDbStore, type MemoryStore, type DB } from './store';
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

/** Save step 3: write every page whose content changed; unchanged pages keep their old ref. */
async function commitPages(store: Store, id: string, pages: Pages, base: number, live: Bookmark[], prev?: Record<string, PageRef>): Promise<Record<string, PageRef>> {
  const refs: Record<string, PageRef> = {};
  for (const [key, page] of Object.entries(pages)) {
    const bytes = byteLength(page);
    if (bytes > PAGE_LIMIT) throw new SaveError('page_too_large', `page ${key} is ${bytes} bytes, over 256 KiB`);
    const hash = hashPage(page);
    if (prev?.[key]?.hash === hash) { refs[key] = prev[key]; continue; }
    const { v, reuse } = pickVersion(key, base, hash, live);
    if (!reuse) await store.set(pagePath(id, key, v), page);
    refs[key] = { version: v, hash, bytes };
  }
  return refs;
}

async function readPages(store: Store, id: string, bm: Bookmark, r: CheckReport): Promise<Pages> {
  const pages: Pages = {};
  for (const [key, ref] of Object.entries(bm.pages)) {
    const page = await store.get(pagePath(id, key, ref.version));
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
  const head = await guard(async () => {
    const prev = await store.get<Head>(headPath(id));
    const live = prev ? [bookmarkOf(prev), ...(prev.undo ? [prev.undo] : []), ...(prev.safety ? [prev.safety] : [])] : [];
    const refs = await commitPages(store, id, toPages(state), record.turn, live, prev?.pages);
    await store.set(turnPath(id, record.turn), fitRecord(record));
    const meta: StoryMeta = { ...state.meta, settings: state.settings };
    const stored = await store.get(story(id));
    if (stableStringify(stored) !== stableStringify(meta)) await store.set(story(id), meta);
    // safety (pre-migration or pre-restore) is dropped after this good turn
    const head: Head = { storyId: id, turn: record.turn, pages: refs, schemaVersion: CONFIG.SCHEMA_VERSION, libraryVersion: state.libraryVersion, undo: prev ? bookmarkOf(prev) : null };
    await store.set(headPath(id), head);
    return head;
  });
  await guard(async () => {
    await cleanup(store, id, head);
    if (record.turn > 0 && record.turn % CONFIG.BACKUP_EVERY === 0) await writeBackup(store, id, head);
  }, true);
  return head;
}

/** Save step 6: drop page versions no bookmark points to, and turn records older than the last N. */
async function cleanup(store: Store, id: string, head: Head): Promise<void> {
  const keep = new Set([head, head.undo, head.safety].filter((b): b is Bookmark => !!b).flatMap((b) => Object.entries(b.pages).map(([k, r]) => pagePath(id, k, r.version))));
  for (const p of await store.list(`${story(id)}/pages`)) if (!keep.has(p)) await store.delete(p);
  for (const p of await store.list(`${story(id)}/turns`)) if (+tail(p) <= head.turn - CONFIG.TURN_RECORDS_KEPT) await store.delete(p);
}

// ---------- load ----------
/** Load: checksums, migrations, library reconcile, invariants, references; then build GameState. Throws LoadRefusedError. */
export async function loadStory(store: Store, storyId: string, library: Library): Promise<{ state: GameState; report: string[] }> {
  return guard(async () => {
    const r = newReport();
    const head = await store.get<Head>(headPath(storyId));
    const meta = await store.get<StoryMeta>(story(storyId));
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
  return metas.filter((m): m is StoryMeta => !!m).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.storyId.localeCompare(a.storyId));
}

// ---------- a story still starting ----------
/** Ali (08/11/2026): closing the game during turn 0 lost the new story, because nothing is saved until the opening
 * scene is planned and narrated. The build is written first; resume finds it and starts the opening again. */
export type PendingStart = { storyId: string; build: CreationBuild; at: string };
const PENDING_START = 'pending/start';
export const savePendingStart = (store: Store, p: PendingStart) => guard(() => store.set(PENDING_START, p));
export const loadPendingStart = (store: Store) => guard(() => store.get<PendingStart>(PENDING_START));
export const clearPendingStart = (store: Store) => guard(() => store.delete(PENDING_START));
/** has this story's first turn been saved (a head exists)? */
export const storySaved = async (store: Store, storyId: string) => !!(await guard(() => store.get(headPath(storyId))));

// ---------- backups (§11) ----------
type BackupDoc = { storyId: string; turn: number; schemaVersion: number; libraryVersion: number; refs: Record<string, PageRef>; parts: number; pages: Pages };

/** Every page the head lists, packed into as few documents as fit: backups/<turn>, then backups/<turn>/parts/<n>. */
export async function writeBackup(store: Store, storyId: string, head: Head): Promise<void> {
  const r = newReport();
  const pages = await readPages(store, storyId, head, r);
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
  for (let i = 1; i < chunks.length; i++) await store.set(`${base}/parts/${i}`, { pages: chunks[i] });
  await store.set(base, { ...envelope, parts: chunks.length - 1, pages: chunks[0] } satisfies BackupDoc);
  const all = (await store.list(`${story(storyId)}/backups`)).sort((a, b) => +tail(b) - +tail(a));
  for (const p of all.slice(CONFIG.BACKUPS_KEPT)) await deleteBackup(store, p);
}

async function deleteBackup(store: Store, path: string): Promise<void> {
  for (const p of await store.list(`${path}/parts`)) await store.delete(p);
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
    for (let i = 1; i <= doc.parts; i++) Object.assign(pages, (await store.get<{ pages: Pages }>(`${backupPath(storyId, turn)}/parts/${i}`))?.pages ?? {});
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
