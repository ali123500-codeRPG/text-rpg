import { BT } from '../../src/library/raceIds';
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage, actor, lay } from '../harness';
import { CONFIG, resetConfig } from '../../src/config';
import { getLibrary } from '../../src/library';
import {
  LoadRefusedError, MIGRATIONS, acquireTurnLock, archiveStory, artifactDbStore, listBackups, listStories, listWorlds, loadStory, memoryStore,
  loadHistory, readTurnRecord, releaseTurnLock, restoreBackup, saveHistory, saveTurn, undoTurn, goBackOneTurn, type DB,
} from '../../src/save';
import type { GameState, Head, LogLine, StoryFact, TurnRecord } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

const rec = (s: GameState, turn: number, extra: Partial<TurnRecord> = {}): TurnRecord =>
  ({ storyId: s.storyId, turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [], ...extra });
const head = async (st: ReturnType<typeof memoryStore>) => (await st.get<Head>('stories/test/control/head'))!;
const lib = () => getLibrary();
/** play `turns` turns: each changes the rng state and the guard's flag */
async function play(st: ReturnType<typeof memoryStore>, s: GameState, from: number, to: number) {
  for (let t = from; t <= to; t++) {
    s.turn = t;
    s.rngState = 1000 + t;
    s.clocks.last = t;
    await saveTurn(st, s, rec(s, t));
  }
}

afterEach(() => {
  resetConfig();
  delete MIGRATIONS[CONFIG.SCHEMA_VERSION]; // the stand-in step a test adds; real steps are keyed below the version
});

describe('save and load', () => {
  it('round-trips the village', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    const { state, report } = await loadStory(st, 'test', lib());
    expect(report).toEqual([]);
    expect(state).toEqual(s);
    expect(state.zones[0]).toBe(state.places.find((p) => p.id === 'tavern')!.zones[0]);
    expect((await listStories(st)).map((m) => m.storyId)).toEqual(['test']);
  });

  it('writes only changed pages; head is the commit', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    actor(s, 'guard_1').zone = 'street_square';
    actor(s, 'guard_1').placeId = 'street';
    const h = await saveTurn(st, s, rec(s, 1));
    expect(h.pages['actor.guard_1'].version).toBe(1);
    expect(h.pages['actor.trader'].version).toBe(0);
    expect(h.undo!.turn).toBe(0);
    expect(await readTurnRecord(st, 'test', 1)).toMatchObject({ turn: 1 });
  });

  it('a failed write before the head keeps the last good save (quota_exceeded)', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    s.clocks.x = 1;
    st.failNext = { match: /control\/head/, code: 'quota_exceeded' };
    await expect(saveTurn(st, s, rec(s, 1))).rejects.toMatchObject({ code: 'quota_exceeded', committed: false });
    expect((await head(st)).turn).toBe(0);
    expect((await loadStory(st, 'test', lib())).state.clocks.x).toBeUndefined();
  });

  it('BG-336: a story whose first head write failed is no story yet, so the world it was carrying on stays free', async () => {
    const st = memoryStore();
    const old = makeVillage();
    await saveTurn(st, old, rec(old, 0));
    await archiveStory(st, 'test', '2026-11-10T10:00:00Z', undefined, { name: 'Aldric', day: 1, threadbound: [] });
    const s: GameState = JSON.parse(JSON.stringify(makeVillage()).replaceAll('"storyId":"test"', '"storyId":"next"'));
    s.meta = { ...s.meta, storyId: 'next', worldId: 'test' };
    st.failNext = { match: /control\/head/, code: 'store_error' };
    await expect(saveTurn(st, s, rec(s, 0))).rejects.toMatchObject({ committed: false });
    expect(await st.get('stories/next')).not.toBeNull(); // the meta went out with the pages; only the head failed
    expect(await listStories(st)).toEqual([]);
    expect((await listWorlds(st)).map((w) => w.worldId)).toEqual(['test']);
  });

  it('refuses a tampered page and leaves the save untouched', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    const h = await head(st);
    const path = `stories/test/pages/actor.player@${h.pages['actor.player'].version}`;
    st.docs.set(path, st.docs.get(path)!.replace('"Aldric"', '"Mallory"'));
    const before = new Map(st.docs);
    const err = await loadStory(st, 'test', lib()).catch((e) => e);
    expect(err).toBeInstanceOf(LoadRefusedError);
    expect(err.report[0]).toMatch(/checksum: page actor.player/);
    expect(err.canGoBack).toBe(false); // the first turn has no turn before it
    expect(st.docs).toEqual(before);
  });

  it('refuses invariant failures; going back one turn takes the undo bookmark', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    s.player.core.classes.push({ classId: 'slime', state: 'current', level: 1 });
    s.player.core.inventory.push({ id: 'c2', itemId: IT.coin, qty: 0 });
    await saveTurn(st, s, rec(s, 1));
    const err = await loadStory(st, 'test', lib()).catch((e) => e);
    expect(err.report).toEqual(expect.arrayContaining([expect.stringMatching(/more than one current class/), expect.stringMatching(/qty < 1/)]));
    expect(err.canGoBack).toBe(true);
    const back = await goBackOneTurn(st, 'test', lib());
    expect(back.state.player.core.classes).toHaveLength(1);
    expect((await head(st)).turn).toBe(0);
  });

  it('repairs dangling references, drops ground items and routines the library no longer has, and reports them; keeps NPC view history (recentEvents); raw past its cap is fine (no hard limit, D-374 TB7)', async () => {
    const s = makeVillage();
    s.player.journal!.factsWitnessed.push('f_missing');
    actor(s, 'guard_1').mind!.knowledge.ghost = { status: 'aware', source: 'seen', revealed: [] };
    s.player.core.skills[SK.melee_medium] = { raw: 104, state: 'normal' };
    s.player.core.skills[SK.melee_light] = { raw: 120, state: 'tagged' };
    lay(s, s.zones[0].id, { id: 'gi1', itemId: 'retired_item' });
    s.recentEvents = [{ id: 't0.1', turn: 0, actorId: 'player', kind: 'speak', zone: 'tav_common', effects: [], noise: 'quiet', visibility: 'normal', perception: { patron_1: { level: 'full', cue: 'sound' } } } as never];
    const g = actor(s, 'guard_1').mind!;
    const real = [...g.routines!];
    g.routines = [...real, 'retired_routine'];
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    const { state, report } = await loadStory(st, 'test', lib());
    expect(state.player.journal!.factsWitnessed).toEqual([]);
    expect(actor(state, 'guard_1').mind!.knowledge.ghost).toBeUndefined();
    expect(state.ground.map((i) => i.id)).not.toContain('gi1'); // so zone views cannot throw
    expect(state.recentEvents?.map((e) => e.id)).toEqual(['t0.1']);
    expect(actor(state, 'guard_1').mind!.routines).toEqual(real);
    expect(report).toEqual(expect.arrayContaining([expect.stringMatching(/witnessed facts f_missing/), expect.stringMatching(/belief about ghost/), expect.stringMatching(/unknown ground items/)]));
    expect(report.some((l) => l.includes('above its cap'))).toBe(false);
    expect((await loadStory(st, 'test', lib())).report).toEqual([]); // repair was saved
  });

  it('splits a busy place into several facts pages', async () => {
    const s = makeVillage();
    const text = 'x'.repeat(1000);
    s.facts = Array.from({ length: 400 }, (_, i): StoryFact => ({ id: `f${i}`, storyId: 'test', placeId: 'tavern', turn: i, text, refs: [], source: 'rule', promotedTo: [] }));
    const st = memoryStore();
    const h = await saveTurn(st, s, rec(s, 0));
    expect(Object.keys(h.pages).filter((k) => k.startsWith('facts.tavern.')).length).toBeGreaterThan(1);
    expect((await loadStory(st, 'test', lib())).state.facts).toEqual(s.facts);
  });
});

describe('head size', () => {
  it('refuses a head over the document limit before writing anything', async () => {
    const st = memoryStore();
    const s = makeVillage();
    // the head lists every page by key, so 4,000 pages with long ids pass 256 KiB; bare blueprints are the cheapest pages
    // to build (any page kind is listed the same way)
    for (let i = 0; i < 4000; i++) s.blueprints.push({ id: `bp_${i}_${"x".repeat(20)}` } as never);
    await expect(saveTurn(st, s, rec(s, 0))).rejects.toMatchObject({ code: 'page_too_large', committed: false });
    expect([...st.docs.keys()]).toEqual([]);
  });
});

describe('undo', () => {
  it('goes back one turn, carries the RNG state forward, drops the turn record', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await play(st, s, 1, 2);
    await undoTurn(st, 'test');
    const { state } = await loadStory(st, 'test', lib());
    expect(state.clocks.last).toBe(1);
    expect(state.rngState).toBe(1002); // not rolled back
    expect(await readTurnRecord(st, 'test', 2)).toBeNull();
    await expect(undoTurn(st, 'test')).rejects.toMatchObject({ code: 'nothing_to_undo' }); // D-72: one turn
    s.clocks.last = 2; s.rngState = 2002;
    await saveTurn(st, s, rec(s, 2)); // redo writes turn 2 again without touching the live engine page
    expect((await loadStory(st, 'test', lib())).state.rngState).toBe(2002);
    await undoTurn(st, 'test');
    expect((await loadStory(st, 'test', lib())).state.rngState).toBe(2002);
  });
});

describe('cleanup, backups, restore', () => {
  it('keeps the last N turn records and only pages a bookmark points to', async () => {
    const s = makeVillage();
    CONFIG.TURN_RECORDS_KEPT = 3;
    const st = memoryStore();
    await play(st, s, 1, 6);
    expect(await st.list('stories/test/turns')).toEqual(['stories/test/turns/4', 'stories/test/turns/5', 'stories/test/turns/6']);
    const h = await head(st);
    const live = new Set([h, h.undo!].flatMap((b) => Object.entries(b.pages).map(([k, r]) => `stories/test/pages/${k}@${r.version}`)));
    expect(new Set(await st.list('stories/test/pages'))).toEqual(live);
  });

  it('works ordinary cleanups out from the old head, and sweeps what a failed save left on backup turns', async () => {
    const s = makeVillage();
    CONFIG.BACKUP_EVERY = 4;
    const st = memoryStore();
    const stray = async () => {
      const h = await head(st);
      const live = new Set([h, h.undo!].flatMap((b) => Object.entries(b.pages).map(([k, r]) => `stories/test/pages/${k}@${r.version}`)));
      return (await st.list('stories/test/pages')).filter((p) => !live.has(p));
    };
    await play(st, s, 1, 1);
    st.failNext = { match: /control\/head/, code: 'store_error' };
    await expect(play(st, s, 2, 2)).rejects.toMatchObject({ committed: false }); // turn 2's pages are written, never committed
    await play(st, s, 3, 3);
    expect((await stray()).length).toBeGreaterThan(0); // no bookmark ever held them, so only a sweep finds them
    await play(st, s, 4, 4); // a backup turn lists and sweeps
    expect(await stray()).toEqual([]);
  });

  it('backs up every BACKUP_EVERY turns, keeps BACKUPS_KEPT, and backs up the save a restore replaces', async () => {
    const s = makeVillage();
    CONFIG.BACKUP_EVERY = 2;
    CONFIG.BACKUPS_KEPT = 2;
    const st = memoryStore();
    await play(st, s, 1, 7);
    expect((await listBackups(st, 'test')).map((b) => b.turn)).toEqual([6, 4]);
    const { state } = await restoreBackup(st, 'test', 4, lib());
    expect(state.clocks.last).toBe(4);
    expect((await head(st))).toMatchObject({ turn: 4, undo: null });
    // turn 7 is backed up first; turn 4 lives on as the head
    expect((await listBackups(st, 'test')).map((b) => b.turn)).toEqual([7, 6]);
    expect((await restoreBackup(st, 'test', 7, lib())).state.clocks.last).toBe(7);
    await play(st, state, 5, 5);
    expect((await loadStory(st, 'test', lib())).state.clocks.last).toBe(5);
  });
});

describe('migration and reconcile', () => {
  it('runs numbered steps on load and backs up first', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await play(st, s, 1, 2);
    const V = CONFIG.SCHEMA_VERSION;
    CONFIG.SCHEMA_VERSION = V + 1;
    MIGRATIONS[V] = (pages) => { (pages.engine as { clocks: Record<string, unknown> }).clocks.migrated = 1; };
    const { state, report } = await loadStory(st, 'test', lib());
    expect(state.clocks.migrated).toBe(1);
    expect(report).toContain(`migrated v${V} -> v${V + 1}`);
    const h = await head(st);
    expect(h).toMatchObject({ schemaVersion: V + 1, undo: null });
    expect((await listBackups(st, 'test')).map((b) => b.turn)).toEqual([2]);
    // the backup taken before the migration can be restored (it migrates again)
    expect((await restoreBackup(st, 'test', 2, lib())).state.clocks.migrated).toBe(1);
    delete MIGRATIONS[V];
  });

  it('YB5: a look (a fallen character\'s sheet) migrates in memory and writes nothing: no backup, no new head', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await play(st, s, 1, 2);
    const V = CONFIG.SCHEMA_VERSION, before = await head(st);
    CONFIG.SCHEMA_VERSION = V + 1;
    MIGRATIONS[V] = (pages) => { (pages.engine as { clocks: Record<string, unknown> }).clocks.migrated = 1; };
    const { state } = await loadStory(st, 'test', lib(), true);
    expect(state.clocks.migrated).toBe(1);
    expect(await head(st)).toEqual(before);
    expect(await listBackups(st, 'test')).toEqual([]);
    delete MIGRATIONS[V];
  });

  it('refuses when a step is missing and leaves the save untouched', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    const V = CONFIG.SCHEMA_VERSION;
    CONFIG.SCHEMA_VERSION = V + 2;
    MIGRATIONS[V] = () => {};
    const err = await loadStory(st, 'test', lib()).catch((e) => e);
    expect(err.report).toContain(`schema: no migration step v${V + 1} -> v${V + 2}`);
    expect((await head(st)).schemaVersion).toBe(V);
    delete MIGRATIONS[V];
  });

  it('follows renamed entries, marks deleted ones dormant, syncs body parts', async () => {
    const s = makeVillage();
    const st = memoryStore();
    await saveTurn(st, s, rec(s, 0));
    const l = structuredClone(lib());
    l.version = 2;
    l.skills.blades = { ...l.skills[SK.melee_medium], id: 'blades' };
    delete l.skills[SK.melee_medium];
    delete l.skills[SK.barter];
    l.status = { [SK.melee_medium]: { state: 'renamed', to: 'blades' }, [SK.barter]: { state: 'deleted' } };
    l.bodyTypes[BT.humanoid].parts.push({ id: 'tail', size: 'small', impact: 'non_essential', roles: [] });
    const { state, report } = await loadStory(st, 'test', l);
    expect(state.player.core.skills.blades).toEqual({ raw: 50, state: 'tagged' });
    expect(state.player.core.skills[SK.melee_medium]).toBeUndefined();
    expect(state.player.core.skills[SK.barter].dormant).toBe(true);
    expect(state.player.core.condition.parts.tail).toBe(100);
    expect(state.libraryVersion).toBe(2);
    expect(report).toEqual(expect.arrayContaining([`reconcile: player skill ${SK.melee_medium} -> blades`, `reconcile: player skill ${SK.barter} dormant`]));
    expect((await head(st)).libraryVersion).toBe(2);
  });
});

describe('turn lock', () => {
  it('one window at a time; the lease expires', async () => {
    let now = 0;
    const st = memoryStore(() => now);
    expect(await acquireTurnLock(st, 'test', 'A')).toBe(true);
    expect(await acquireTurnLock(st, 'test', 'B')).toBe(false);
    now += CONFIG.LOCK_LEASE_MS + 1;
    expect(await acquireTurnLock(st, 'test', 'B')).toBe(true);
    await releaseTurnLock(st, 'test', 'B');
    expect(await acquireTurnLock(st, 'test', 'A')).toBe(true);
  });
});

describe('artifact db adapter', () => {
  it('maps the Store onto the db capability, retrying once on unavailable', async () => {
    const calls: string[] = [];
    let fail = 1;
    const docs = new Map<string, Record<string, unknown>>();
    const ref = (path: string) => ({
      id: path.split('/').pop()!, path,
      async get() { return { id: path, exists: docs.has(path), data: () => docs.get(path) }; },
      async set(d: Record<string, unknown>) {
        if (fail-- > 0) throw { code: 'unavailable', message: 'x' };
        docs.set(path, d);
      },
      async delete() { docs.delete(path); },
      async acquire(o: { holder: string; ttlMs?: number }) { calls.push(`acquire ${path} ${o.holder} ${o.ttlMs}`); return { acquired: true }; },
    });
    const db: DB = {
      doc: ref,
      collection: (p: string) => {
        const q = { limit: () => q, get: async () => { const d = [...docs.keys()].filter((k) => k.startsWith(p + '/')).map((k) => ({ id: k.slice(p.length + 1), exists: true, data: () => docs.get(k) })); return { docs: d, size: d.length }; } };
        return { ...q, path: p, doc: (id?: string) => ref(`${p}/${id}`) };
      },
    };
    const st = artifactDbStore(db, async () => {});
    await st.set('stories/a', { x: 1 });
    expect(await st.get('stories/a')).toEqual({ x: 1 });
    expect(await st.list('stories')).toEqual(['stories/a']);
    expect(await st.acquireLease('stories/a/control/lock', 'w1', 60000)).toBe(true);
    await st.releaseLease('stories/a/control/lock', 'w1');
    expect(calls).toEqual(['acquire stories/a/control/lock w1 60000', 'acquire stories/a/control/lock w1 1000']);
    fail = 2;
    await expect(st.set('stories/b', {})).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('story text (Q18)', () => {
  it('saves the story column in chunks of HISTORY_CHUNK_TURNS turns and loads it back whole, in order', async () => {
    const st = memoryStore();
    const lines: LogLine[] = [];
    let saved = 0;
    for (let t = 0; t <= 45; t++) {
      lines.push({ turn: t, kind: 'player', text: `go ${t}` }, { turn: t, kind: 'narration', text: `turn ${t}`, mechanics: ['d100 50'] });
      await saveHistory(st, 'a', lines, saved);
      saved = lines.length;
    }
    expect((await st.list('stories/a/history')).length).toBe(3); // turns 0-19, 20-39, 40-45
    expect(await loadHistory(st, 'a')).toEqual(lines);
    expect(await loadHistory(st, 'b')).toEqual([]);
  });

  it('a line added late for an earlier chunk rewrites that chunk too', async () => {
    const st = memoryStore();
    const lines: LogLine[] = [{ turn: 19, kind: 'narration', text: 'a' }];
    await saveHistory(st, 'a', lines, 0);
    lines.push({ turn: 19, kind: 'command', text: 'Difficulty: hard.' }, { turn: 20, kind: 'narration', text: 'b' });
    await saveHistory(st, 'a', lines, 1);
    expect((await loadHistory(st, 'a')).map((l) => l.text)).toEqual(['a', 'Difficulty: hard.', 'b']);
  });

  it('a chunk over 256 KiB keeps the text and drops the code-built extras', async () => {
    const st = memoryStore();
    const big = 'x'.repeat(40_000);
    const lines: LogLine[] = Array.from({ length: 5 }, (_, i) => ({ turn: i, kind: 'narration' as const, text: `t${i}`, mechanics: [big, big] }));
    await saveHistory(st, 'a', lines, 0);
    expect(await loadHistory(st, 'a')).toEqual(lines.map(({ turn, kind, text }) => ({ turn, kind, text })));
  });
});

describe('save and load round trips', () => {
  /** a store that counts how many requests wait in line: each "round" is one database round trip in play */
  function rounds(st: ReturnType<typeof memoryStore>) {
    let open = 0, n = 0;
    const wrap = <A extends unknown[], R>(f: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
      if (open++ === 0) n++;
      await new Promise((r) => setTimeout(r, 1));
      try { return await f(...a); } finally { open--; }
    };
    const s = { ...st, get: wrap(st.get), set: wrap(st.set), delete: wrap(st.delete), list: wrap(st.list) } as typeof st;
    return { s, count: () => n, reset: () => { n = 0; } };
  }

  it('a turn save, a backup and a load each take a few round trips, not one per page', async () => {
    const mem = memoryStore(), r = rounds(mem), s = makeVillage();
    await play(r.s, s, 1, 2);
    const pages = Object.keys((await head(mem)).pages).length;
    expect(pages).toBeGreaterThan(8);
    r.reset();
    await play(r.s, s, 3, 3);
    expect(r.count()).toBeLessThanOrEqual(4); // head + meta, pages + record, head, deletes worked out from the old head
    r.reset();
    s.turn = CONFIG.BACKUP_EVERY;
    await saveTurn(r.s, s, rec(s, CONFIG.BACKUP_EVERY)); // the backup packs the pages just saved, no read-back
    expect(r.count()).toBeLessThanOrEqual(8);
    r.reset();
    await loadStory(r.s, s.storyId, lib());
    expect(r.count()).toBeLessThanOrEqual(2); // head + meta, then every page together
  });
});
