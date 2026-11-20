// node tools/questions-hub/checks/stores.mjs (from the repo root): bothDb shows both stores and writes each questionnaire to its own; runOutbox runs hubdb.outbox() files once
import fs from 'fs'; import assert from 'assert';
const h = fs.readFileSync('tools/questions-hub/hub.html', 'utf8');
const src = h.slice(h.indexOf('function bothDb('), h.indexOf('\n}\n', h.indexOf('function bothDb(')) + 2);
const bothDb = new Function(src + '; return bothDb;')();
const mem = (store) => { const snap = (p) => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p] });
  const inC = (c) => Object.keys(store).filter((k) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).sort();
  return { has: async (p) => p in store, ids: async (c) => inC(c).map((k) => k.split('/').pop()), doc: (p) => ({ get: async () => snap(p), set: async (v) => { store[p] = v; }, delete: async () => { delete store[p]; },
      onSnapshot: (cb) => { cb(snap(p)); return () => {}; } }),
    collection: (c) => ({ get: async () => ({ docs: inC(c).map(snap) }), where: (f, op, v) => ({ get: async () => ({ docs: inC(c).map(snap).filter((d) => d.data()[f] > v) }) }),
      onSnapshot: (cb) => { cb({ docs: inC(c).map(snap) }); return () => {}; } }) }; };
const A = { 'pages/new': { updated: '2' }, 'qs/new/items/N1': { t: 1 }, 'pages/dup': { from: 'A' } };
const B = { 'pages/old': { updated: '1' }, 'qs/old/items/O1': { t: 2 }, 'pages/dup': { from: 'B' } };
const db = bothDb(mem(A), mem(B));
const ids = (await db.collection('pages').get()).docs.map((d) => d.id);
assert.deepStrictEqual(ids.sort(), ['dup', 'new', 'old']);                                       // union, no duplicate
assert.strictEqual((await db.doc('pages/dup').get()).data().from, 'A');                          // Supabase wins a clash
assert.deepStrictEqual((await db.collection('qs/old/items').get()).docs.map((d) => d.id), ['O1']); // read where the page is
await db.doc('answers/old/items/O1').set({ text: 'b.' }); await db.doc('answers/new/items/N1').set({ text: 'a.' });
assert.ok(B['answers/old/items/O1'] && !A['answers/old/items/O1']);                              // answer goes with its page
assert.ok(A['answers/new/items/N1'] && !B['answers/new/items/N1']);
await db.doc('view/qhub_last').set({ v: 'old' }); assert.ok(A['view/qhub_last']);                 // page-less docs: shared
const fresh = bothDb(mem(A), mem(B)); let got; fresh.collection('qs/old/items').onSnapshot((s) => { got = s; });
await new Promise((r) => setTimeout(r, 10)); assert.deepStrictEqual(got.docs.map((d) => d.id), ['O1']); // no listing first
assert.strictEqual((await db.collection('pages').where('updated', '>', '1').get()).docs.map((d) => d.id).join(), 'new');
assert.deepStrictEqual((await db.ids('pages')).sort(), ['dup', 'new', 'old']);                    // names from both, once
B['imgs/old/items/m1'] = { src: 'data:,x' };
assert.deepStrictEqual((await db.collection('imgs/old/items').get()).docs.map((d) => d.id), ['m1']);   // pictures go with their page
console.log('bothDb: all checks pass');

// copyOlder: whole questionnaires, in batches under the size cap, never over a row that is already in Supabase
const cut = (name) => h.slice(h.indexOf(name), h.indexOf('\n}\n', h.indexOf(name)) + 2);
const copyOlder = new Function(cut('const COPY_MAX') .replace(/^const COPY_MAX = \d+;.*$/m, 'const COPY_MAX = 60;') + '; return copyOlder;')();
const S = { 'pages/kept': { from: 'S' } }, calls = [];
const O = { 'pages/p1': { title: 'one', spec: "it's" }, 'rounds/p1/items/r1': { n: 0 }, 'qs/p1/items/Q1': { i: 0 }, 'answers/p1/items/Q1': { text: 'a.' },
  'pages/p2': { title: 'two' }, 'answers/p2/items/Z1': { text: 'b.' }, 'pages/kept': { from: 'O' }, 'answers/kept/items/K1': { text: 'old' }, 'hub/index': { x: 1 } };
const shared = { ...mem(S), insertNew: async (rows) => { calls.push(rows.map((r) => r[0])); for (const [p, v] of rows) if (!(p in S)) S[p] = v; } };
const todo = (await mem(O).collection('pages').get()).docs.filter((d) => !(('pages/' + d.id) in S)), seen = [];
assert.strictEqual(await copyOlder(mem(O), shared, todo, (d) => seen.push(d)), 2);
assert.deepStrictEqual(calls, [['pages/p1', 'rounds/p1/items/r1', 'qs/p1/items/Q1', 'answers/p1/items/Q1'], ['pages/p2', 'answers/p2/items/Z1']]); // a questionnaire is never split
assert.deepStrictEqual(seen, [1, 2]);
assert.strictEqual(S['pages/kept'].from, 'S'); assert.ok(!('answers/kept/items/K1' in S) && !('hub/index' in S)); // already there: untouched; caches: not copied
assert.strictEqual(S['pages/p1'].spec, "it's"); assert.strictEqual(Object.keys(O).length, 9);    // the own copies stay
console.log('copyOlder: all checks pass');

// runOutbox: a file from hubdb.outbox() runs once; a missing, foreign or failed one is recorded with its error, never rerun
import { execFileSync } from 'child_process';
const runOutbox = new Function(cut('async function runOutbox(') + '; return runOutbox;')();
const made = JSON.parse(execFileSync('python3', ['-I', '-c', `
import sys, json, tempfile; sys.path.insert(0, 'tools/questions-hub'); from hubdb import *
out = tempfile.mkdtemp(); old = ['outbox/20200101T000000Z-aaaaaa.sql', 'outbox/20200102T000000Z-bbbbbb.sql', 'kit/x.woff2']
a = outbox(mark('pg', 1, {'Q1': (1, {'done': "a. it's done", 'reask': None})}, out), out, old)
b = outbox(mark('pg', 1, {'Q2': (1, {'done': 'boom'})}, out), out, old + [a[1][0]['as']])
print(json.dumps([a, b]))`]).toString());
const [[idA, filesA], [idB, filesB]] = made, served = Object.fromEntries([...filesA, ...filesB].map((f) => [f.as, fs.readFileSync(f.path, 'utf8')]));
served['outbox/20200102T000000Z-bbbbbb.sql'] = 'begin;\ndrop table hub_docs;\ncommit;';
const get = async (f) => (f in served ? { ok: true, status: 200, json: async () => JSON.parse(served[f]), text: async () => served[f] } : { ok: false, status: 404 });
const T = {}, sent = [];
const sdb = { has: async (p) => p in T, insertNew: async (rows) => { for (const [p, v] of rows) if (!(p in T)) T[p] = v; },
  exec: async (s) => { sent.push(s); const next = { ...T }; // one transaction: all of it or none
    for (const l of s.split('\n').slice(1, -1)) { const p = /values \('([^']*)'/.exec(l)[1];
      if (l.includes('boom')) return 'ERROR: 22P02: boom';
      if (p.startsWith('outbox/') && p in next) return 'ERROR: 23505: duplicate key value violates unique constraint "hub_docs_pkey"';
      next[p] = l; }
    Object.assign(T, next); return '[]'; } };
globalThis.document = { createElement: () => ({}), body: { append() {} } };
assert.deepStrictEqual(JSON.parse(served['outbox/index.json']), ['20200101T000000Z-aaaaaa', '20200102T000000Z-bbbbbb', idA, idB]); // in time order
assert.strictEqual(await runOutbox(sdb, get), 1);
assert.ok(T['outbox/' + idA] && /'qs\/pg\/items\/Q1'.*it''s done.*- array\['reask'\]/.test(T['qs/pg/items/Q1']) && T['pages/pg']); // A written, marker included
assert.match(T['outbox/20200101T000000Z-aaaaaa'].error, /no file outbox\/20200101T000000Z-aaaaaa\.sql \(404\)/);
assert.strictEqual(T['outbox/20200102T000000Z-bbbbbb'].error, 'not a file from hubdb.outbox()');           // never sent
assert.strictEqual(T['outbox/' + idB].error, 'ERROR: 22P02: boom'); assert.ok(!('qs/pg/items/Q2' in T));  // rolled back, reason kept
assert.strictEqual(sent.length, 2);
assert.strictEqual(await runOutbox(sdb, get), 0); assert.strictEqual(sent.length, 2);                    // nothing runs twice or retries
console.log('runOutbox: all checks pass');
