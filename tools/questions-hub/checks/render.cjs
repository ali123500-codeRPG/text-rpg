// usage: node render.cjs <page.json> <out.png> [width]
const { chromium } = require('playwright'); const fs = require('fs');
const [,, src, out, w, ids] = process.argv;
const doc = JSON.parse(fs.readFileSync(src, 'utf8')); const d = doc.data || doc;
const hub = fs.readFileSync(__dirname + '/../hub.html', 'utf8');
const stub = `<script>window.claude={use:async()=>{const P=${JSON.stringify(d)};
const snap=(x)=>({data:()=>x,exists:!!x});
const doc=(p)=>({get:async()=>snap(p.startsWith('view/qhub_last')?{v:'T'}:p==='pages/T'?P:null),set:async()=>{},onSnapshot:(cb)=>{cb(snap(p==='pages/T'?P:null));return()=>{}}});
const col=(p)=>({get:async()=>({docs:p==='pages'?[{id:'T',data:()=>P}]:[]}),onSnapshot:(cb)=>{cb({docs:[]});return()=>{}}});
return {doc,collection:col};}};</script>`;
const html = hub.includes('<head>') ? hub.replace('<head>', '<head>' + stub) : stub + hub;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +(w || 1440), height: 900 } });
  await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(800);
  if (ids) { await p.addStyleTag({ content: '.top{position:static!important}' }); for (const id of ids.split(',')) { const el = await p.$('#' + id); if (el) await el.screenshot({ path: out.replace('.png', '-' + id + '.png') }); } } else await p.screenshot({ path: out, fullPage: true }); await b.close(); })();
