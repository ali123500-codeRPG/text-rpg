const { chromium } = require('playwright'); const fs = require('fs');
const seeds = JSON.parse(fs.readFileSync('seeds.json', 'utf8')), mock = fs.readFileSync('mock.js', 'utf8');
const OLD = fs.readFileSync('hub-old.html', 'utf8'), NEW = fs.readFileSync(__dirname + '/../hub.html', 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const merge = (st, add) => { for (const [p, v] of Object.entries(add)) st[p] = p.startsWith('pages/') && st[p] ? { ...st[p], ...v } : v; return st; };
let b;
async function open(hub, seed, opts = {}) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.setContent(`<script>window.__seed=${JSON.stringify(seed)};window.__lag=${JSON.stringify(opts.lag || {})}</script>` + mock + hub);
  await p.waitForTimeout(opts.wait || 600); return p;
}
const grab = (p) => p.evaluate(() => ['qList', 'map', 'counts', 'rulesText', 'legend', 'extra', 'prog', 'title', 'intro'].map((id) => document.getElementById(id).innerHTML.replace(/ class="q now"/g, ' class="q"').replace(/ now"/g, '"')).join('\n@@\n'));
const article = (p) => p.evaluate(() => [...document.querySelectorAll('#qList article.q')].map((a) => a.id + (a.classList.contains('done') ? '+' : '')));
(async () => {
  b = await chromium.launch();
  for (const n of ['open-parked-items', 'missing-20-and-40-perks', 'lying-and-guile', 'search-by-sound']) {
    const last = { 'view/qhub_last': { v: n } };
    const pOld = await open(OLD, { ...seeds[n].legacy, ...last }); const a = await grab(pOld); await pOld.close();
    const pL = await open(NEW, { ...seeds[n].legacy, ...last }); const l = await grab(pL); await pL.close();
    const pM = await open(NEW, { ...seeds[n].migrated, ...last }, { lag: { qs: 400 }, wait: 900 }); const m = await grab(pM); await pM.close();
    ok(a.length > 1000 && a === l, `${n}: older page in the new hub draws exactly as before (${a.length} chars)`);
    ok(a === m, `${n}: moved page (rounds + question docs, questions late) draws exactly as before`);
  }
  const n = 'open-parked-items', last = { 'view/qhub_last': { v: n }, 'answers/open-parked-items/items/D-21': { text: 'a', at: '2026-11-19T02:00:00Z' } };
  // scroll restore waits for the late question docs
  const pS = await open(NEW, { ...seeds[n].migrated, ...last, 'view/qpos_open-parked-items': { v: { y: 0, id: 'D-35', off: 200 } } }, { lag: { qs: 500, rounds: 300 }, wait: 1500 });
  ok(Math.abs(await pS.evaluate(() => document.getElementById('D-35').getBoundingClientRect().top) - 200) < 3, 'scroll restore lands on the saved question with late docs');
  // a new round written while the page is open: one group doc + question docs + page bump
  await pS.evaluate((w) => { for (const [p, v] of Object.entries(w)) __write(p, p.startsWith('pages/') ? { ...__store[p], ...v } : v); }, seeds.round7);
  await pS.waitForTimeout(300);
  const ids = await article(pS); ok(ids.slice(-2).join() === 'D-40,D-41', 'new round lands at the very bottom: ' + ids.slice(-3).join(' '));
  const map = await pS.evaluate(() => [...document.querySelectorAll('#map a b')].map((x) => x.textContent)); ok(map.slice(-2).join() === 'D-40,D-41', 'index lists the new round last');
  ok(await pS.evaluate(() => document.querySelector('#rulesText').textContent.length > 0), 'rules paste still built');
  // type an answer: autosave writes answers/<page>/items/<ID>
  await pS.fill('#a-D-40', 'a. yes'); await pS.waitForTimeout(900);
  ok(await pS.evaluate(() => __store['answers/open-parked-items/items/D-40']?.text === 'a. yes'), 'autosave writes the answer doc');
  // Submit copies the wake text
  await pS.click('#saveBtn'); await pS.waitForTimeout(300);
  ok(/I answered D-40 in/.test(await pS.textContent('#wakeText')), 'Submit: ' + await pS.textContent('#wakeText'));
  // mark D-21 done on the moved page with a doc update + bump: shows under Answered with Read by Claude
  await pS.evaluate(() => { __write('qs/open-parked-items/items/D-21', { ...__store['qs/open-parked-items/items/D-21'], done: 'a. Done.' }); __write('pages/open-parked-items', { ...__store['pages/open-parked-items'], updated: '2026-11-19T03:10:00Z' }); });
  await pS.waitForTimeout(300);
  ok((await article(pS)).includes('D-21+'), 'marked done moves to Answered');
  ok(/Read by Claude/.test(await pS.textContent('#st-D-21')), 'answer shows Read by Claude after the mark');
  const typed = await pS.inputValue('#a-D-40'); ok(typed === 'a. yes', 'typing survives a re-draw');
  await pS.close();
  // legacy page marked with a small doc laid over its spec entry
  const pK = await open(NEW, { ...seeds[n].legacy, ...last, ...seeds.markLegacy, 'pages/open-parked-items': { ...seeds[n].legacy['pages/open-parked-items'], updated: '2026-11-19T03:05:00Z' } });
  const ids2 = await article(pK), ids0 = (await (async () => { const p = await open(NEW, { ...seeds[n].legacy, ...last }); const r = await article(p); await p.close(); return r; })());
  ok(ids2.includes('D-21+') && ids2.length === ids0.length, 'older page: a doc over D-21 marks it done, nothing duplicated');
  await pK.close();
  // home list: no index, counts from docs
  const home = { ...seeds[n].migrated, ...seeds['lying-and-guile'].legacy };
  merge(home, seeds.round7);
  const pH = await open(NEW, home, { wait: 900 });
  const cards = await pH.evaluate(() => [...document.querySelectorAll('#pageList a')].map((a) => a.dataset.page + ' | ' + a.querySelector('i').textContent + ' | ' + a.querySelector('span').textContent));
  console.log(cards.join('\n'));
  ok(cards.some((c) => c.startsWith('open-parked-items | 8 waiting') && /32 questions/.test(c)), 'home: moved page counts its question docs (30 + 2 new)');
  ok(await pH.evaluate(() => !!__store['hub/index']?.rows?.['open-parked-items']?.qs?.find((q) => q[0] === 'D-41')), 'home index row carries the new question');
  await b.close(); process.exit(fails ? 1 : 0);
})();
