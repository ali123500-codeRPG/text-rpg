<script>
(() => {
const store = window.__store = window.__seed || {}; const subs = []; window.__log = [];
const snapDoc = (p) => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p] ? JSON.parse(JSON.stringify(store[p])) : undefined });
const inColl = (c) => Object.keys(store).filter((k) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).sort();
const snapColl = (c, f) => ({ docs: inColl(c).map(snapDoc).filter((d) => !f || f(d.data())) });
const fire = (p) => setTimeout(() => subs.forEach((s) => { if (s.p === p || p.startsWith(s.p + '/') && !p.slice(s.p.length + 1).includes('/')) s.cb(s.coll ? snapColl(s.p) : snapDoc(p)); }), 5);
const wait = (x) => new Promise((r) => setTimeout(() => r(x), 10));
const doc = (p) => ({ get: async () => { __log.push('get ' + p); return wait(snapDoc(p)); }, set: async (v) => { __log.push('set ' + p); store[p] = JSON.parse(JSON.stringify(v)); fire(p); },
  delete: async () => { delete store[p]; fire(p); }, onSnapshot: (cb) => { const s = { p, cb }; subs.push(s); setTimeout(() => cb(snapDoc(p)), 10); return () => subs.splice(subs.indexOf(s), 1); } });
const collection = (c) => ({ get: async () => { __log.push('list ' + c); return wait(snapColl(c)); },
  where: (f, op, v) => ({ get: async () => wait(snapColl(c, (d) => d[f] > v)) }),
  onSnapshot: (cb) => { const s = { p: c, cb, coll: true }; subs.push(s); setTimeout(() => cb(snapColl(c)), 10 + (window.__lag?.[c.split('/')[0]] || 0)); return () => subs.splice(subs.indexOf(s), 1); } });
window.__write = (p, v) => { if (v === null) delete store[p]; else store[p] = v; fire(p); };
window.claude = { use: async () => ({ doc, collection }) };
})();
</script>
