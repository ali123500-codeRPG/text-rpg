// node livecheck.cjs <live dir> <legacy page json> <name>: the live docs draw exactly like the old page did in the old hub
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [, , L, legacy, n] = process.argv, mock = fs.readFileSync(__dirname + '/mock.js', 'utf8');
const seed = { 'view/qhub_last': { v: n }, ['pages/' + n]: JSON.parse(fs.readFileSync(`${L}/pages/${n}.json`, 'utf8')) };
for (const c of ['rounds', 'qs']) { const d = `${L}/${c}/${n}/items`; if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) seed[`${c}/${n}/items/${f.slice(0, -5)}`] = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); }
const grab = (p) => p.evaluate(() => ['qList', 'map', 'counts', 'rulesText', 'legend', 'extra', 'prog', 'title', 'intro'].map((id) => document.getElementById(id).innerHTML.replace(/ now"/g, '"')).join('\n@@\n'));
(async () => { const b = await chromium.launch(); const run = async (hub, s) => { const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.setContent(`<script>window.__seed=${JSON.stringify(s)}</script>` + mock + fs.readFileSync(hub, 'utf8')); await p.waitForTimeout(700); const g = await grab(p); await p.close(); return g; };
  const a = await run(__dirname + '/hub-old.html', { 'view/qhub_last': { v: n }, ['pages/' + n]: JSON.parse(fs.readFileSync(legacy, 'utf8')) }), m = await run(__dirname + '/../hub.html', seed);
  if (a !== m) { let i = 0; while (a[i] === m[i]) i++; console.log(a.slice(i - 80, i + 80) + "\n---\n" + m.slice(i - 80, i + 80)); }
  console.log(a.length > 500 && a === m ? 'SAME ' : 'DIFFERENT ', n, a.length, m.length); await b.close(); })();
