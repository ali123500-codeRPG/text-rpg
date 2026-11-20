// Save baseline (#1218): database ops, round trips, sizes and CPU for one save, backup, load, story-text save and undo, on
// the test village and on copies of it scaled up. On demand, not in CI:
// npx esbuild scripts/save-baseline.ts --bundle --platform=node --format=esm --outfile=dist/save-baseline.mjs --log-level=warning && node dist/save-baseline.mjs
import { makeVillage } from '../tests/harness';
import { getLibrary } from '../src/library';
import { loadStory, memoryStore, saveTurn, saveHistory, undoTurn, toPages } from '../src/save';
import type { Actor, GameState, Head, LogLine, StoryFact, TurnRecord } from '../src/types';

const rec = (s: GameState, turn: number): TurnRecord => ({ storyId: s.storyId, turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: 'I look around', agentLog: [], events: [], factsAdded: [] });

/** counts ops, bytes written and round trips (requests in flight together count as one) */
function counting(st: ReturnType<typeof memoryStore>) {
  const c = { get: 0, set: 0, delete: 0, list: 0, bytes: 0, rounds: 0 };
  let open = 0;
  const wrap = <A extends unknown[], R>(k: 'get' | 'set' | 'delete' | 'list', f: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
    c[k]++;
    if (k === 'set') c.bytes += JSON.stringify(a[1]).length;
    if (open++ === 0) c.rounds++;
    await new Promise((r) => setTimeout(r, 0));
    try { return await f(...a); } finally { open--; }
  };
  const s = { ...st, get: wrap('get', st.get), set: wrap('set', st.set), delete: wrap('delete', st.delete), list: wrap('list', st.list) } as typeof st;
  return { s, c, reset: () => Object.assign(c, { get: 0, set: 0, delete: 0, list: 0, bytes: 0, rounds: 0 }) };
}

/** the village with `npcs` more people, `places` more places and `facts` more facts (copies with new ids) */
function scaled(npcs: number, places: number, facts: number): GameState {
  const s = makeVillage();
  const npc = s.actors.find((a) => a.mind)!;
  for (let i = 0; i < npcs; i++) s.actors.push({ ...structuredClone(npc), id: `${npc.id}_x${i}` } as Actor);
  const place = s.places[0];
  for (let i = 0; i < places; i++) s.places.push({ ...structuredClone(place), id: `${place.id}_x${i}`, zones: place.zones.map((z) => ({ ...structuredClone(z), id: `${z.id}_x${i}`, placeId: `${place.id}_x${i}` })) });
  for (let i = 0; i < facts; i++) s.facts.push({ id: `f_x${i}`, placeId: s.places[i % s.places.length].id, turn: i % 40, storyId: s.storyId, text: `A remembered thing number ${i}: who did what, where and to whom, kept as canon.`, refs: [], source: "rule", promotedTo: [] } as StoryFact);
  return s;
}

/** a typical turn: the clock and dice move, the player and `touched` people change */
function turn(s: GameState, t: number, touched: number) {
  s.turn = t;
  s.rngState = 1000 + t;
  s.clocks.last = t;
  s.player.core.condition.hpLostPct = t % 7;
  for (const a of s.actors.slice(0, touched)) (a as unknown as { note?: number }).note = t;
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
const ms = (f: () => unknown) => { const t = performance.now(); f(); return performance.now() - t; };

const sizes = { small: [0, 0, 0], medium: [40, 20, 600], large: [250, 120, 4000], huge: [1000, 400, 15000] } as const;
for (const [name, [n, p, f]] of Object.entries(sizes))
    {
      const mem = memoryStore(), { s: st, c, reset } = counting(mem);
      const s = scaled(n, p, f);
      const pages = toPages(s);
      const pageBytes = Object.values(pages).map((x) => JSON.stringify(x).length);
      // CPU of the parts every save repeats over the whole state
      const cpu = { toPages: ms(() => toPages(s)) };
      for (let t = 0; t <= 29; t++) { turn(s, t, 3); await saveTurn(st, s, rec(s, t)); }
      const head = (await mem.get<Head>('stories/test/control/head'))!;
      // one ordinary turn (31), one backup turn (30 is a multiple of BACKUP_EVERY: measured separately)
      reset(); turn(s, 30, 3); let t0 = performance.now(); await saveTurn(st, s, rec(s, 30)); const backupMs = performance.now() - t0; const backup = { ...c };
      reset(); turn(s, 31, 3); t0 = performance.now(); await saveTurn(st, s, rec(s, 31)); const saveMs = performance.now() - t0; const save = { ...c };
      reset(); t0 = performance.now(); await loadStory(st, 'test', getLibrary()); const loadMs = performance.now() - t0; const load = { ...c };
      const lines: LogLine[] = Array.from({ length: 32 * 3 }, (_, i) => ({ turn: Math.floor(i / 3), kind: 'narration', text: 'x'.repeat(900) }));
      await saveHistory(st, 'test', lines, 0);
      reset(); lines.push({ turn: 32, kind: 'narration', text: 'x'.repeat(900) }); await saveHistory(st, 'test', lines, lines.length - 1); const hist = { ...c };
      reset(); await undoTurn(st, 'test'); const undo = { ...c };
      const docs = [...mem.docs.keys()];
      const byKind = (k: string) => docs.filter((d) => d.split('/')[2] === k).length;
      console.log(JSON.stringify({
        name, actors: s.actors.length + 1, places: s.places.length, facts: s.facts.length,
        pages: Object.keys(pages).length, stateBytes: kb(pageBytes.reduce((a, b) => a + b, 0)), biggestPage: kb(Math.max(...pageBytes)),
        headBytes: kb(JSON.stringify(head).length), headPctOfLimit: +(JSON.stringify(head).length / (256 * 1024) * 100).toFixed(1),
        docsInStore: docs.length, pageDocs: byKind('pages'), turnDocs: byKind('turns'), backupDocs: docs.filter((d) => d.includes('/backups/')).length,
        cpuToPagesMs: +cpu.toPages.toFixed(1), saveMs: +saveMs.toFixed(1), backupSaveMs: +backupMs.toFixed(1), loadMs: +loadMs.toFixed(1),
        save, backup, load, history: hist, undo,
      }));
    }
