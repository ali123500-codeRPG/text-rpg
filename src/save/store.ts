// Store adapters: an in-memory fake for tests, and the artifact `db` capability (runtime contract 0.2.96).
import type { Store } from './index';

const segs = (p: string) => p.split('/').length;
function docPath(path: string): void {
  if (!path || segs(path) % 2) throw new TypeError(`document path needs an even segment count: ${path}`);
}

export type MemoryStore = Store & {
  /** raw JSON per path, for tests that tamper with a page */
  docs: Map<string, string>;
  /** next write to a path matching this fails once with the given code */
  failNext?: { match: RegExp; code: string };
};

/** JSON-isolated in-memory store; same path rules as the artifact db. `now` drives lease expiry in tests. */
export function memoryStore(now: () => number = () => 0): MemoryStore {
  const docs = new Map<string, string>();
  const leases = new Map<string, { owner: string; until: number }>();
  const s: MemoryStore = {
    docs,
    async get<T>(path: string) {
      docPath(path);
      const v = docs.get(path);
      return v === undefined ? null : (JSON.parse(v) as T);
    },
    async set(path, value) {
      docPath(path);
      if (s.failNext && s.failNext.match.test(path)) {
        const code = s.failNext.code;
        s.failNext = undefined;
        throw { code, message: `injected ${code}` };
      }
      docs.set(path, JSON.stringify(value));
    },
    async delete(path) {
      docPath(path);
      docs.delete(path);
    },
    async list(prefix) {
      const n = segs(prefix) + 1;
      return [...docs.keys()].filter((k) => k.startsWith(prefix + '/') && segs(k) === n).sort();
    },
    async acquireLease(path, owner, ms) {
      const l = leases.get(path);
      if (l && l.owner !== owner && l.until > now()) return false;
      leases.set(path, { owner, until: now() + ms });
      return true;
    },
    async releaseLease(path, owner) {
      if (leases.get(path)?.owner === owner) leases.delete(path);
    },
  };
  return s;
}

// ---- the artifact db capability: the subset of 0.2.96/db.d.ts this adapter calls ----
export type DbError = { code: string; message: string };
export type DbDocumentSnapshot = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
export type DbDocumentReference = {
  id: string;
  path: string;
  get(): Promise<DbDocumentSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  acquire(o: { holder: string; ttlMs?: number; data?: Record<string, unknown> }): Promise<{ acquired: boolean; version?: number; expiresAt?: string; holder?: string }>;
};
export type DbQuery = { limit(n: number): DbQuery; get(): Promise<{ docs: DbDocumentSnapshot[]; size: number }> };
export type DbCollectionReference = DbQuery & { path: string; doc(id?: string): DbDocumentReference };
export type DB = { doc(path: string): DbDocumentReference; collection(path: string): DbCollectionReference };

const LIST_LIMIT = 1000; // platform maximum page size

/** Store over `await claude.use("db")`. Retries a call once on `unavailable` after a short randomized delay. */
export function artifactDbStore(db: DB, delay: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Store {
  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if ((e as DbError)?.code !== 'unavailable') throw e;
      await delay(200 + Math.floor(Math.random() * 400));
      return fn();
    }
  }
  return {
    async get<T>(path: string) {
      const snap = await call(() => db.doc(path).get());
      return snap.exists ? (structuredClone(snap.data()) as T) : null;
    },
    set: (path, value) => call(() => db.doc(path).set(value as Record<string, unknown>)),
    delete: (path) => call(() => db.doc(path).delete()),
    async list(prefix) {
      // shortcut: one page of LIST_LIMIT docs; story collections stay far below it (pages are cleaned every turn)
      const q = await call(() => db.collection(prefix).limit(LIST_LIMIT).get());
      return q.docs.map((d) => `${prefix}/${d.id}`);
    },
    async acquireLease(path, owner, ms) {
      return (await call(() => db.doc(path).acquire({ holder: owner, ttlMs: ms }))).acquired;
    },
    async releaseLease(path, owner) {
      // the platform has no release verb: renew with the minimum lease (1 s) so it lapses at once
      await call(() => db.doc(path).acquire({ holder: owner, ttlMs: 1000 }));
    },
  };
}
