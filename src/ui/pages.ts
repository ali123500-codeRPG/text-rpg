// Character (/stats) uses the character sheet (charsheet.ts). Inventory (/inv) and Quests (/quests) share one page shape. Visibility tiles on top (one per group),
// figures that can't be filtered in a text line under them, then the grouped table.
import type { Actor, GameApi, GameState } from '../types';
import { itemDef } from '../library';
import { groupedTable, type PanelRow, h, natural, openPanel, plural, unitOf, visPass, visTiles, type Col, type TGroup, type TRow, type VisState } from './kit';
import { charCard, invFocus, treeBars } from './charsheet';

type Spec = {
  title: string; intro: string; noun: [string, string]; cols: Col[]; empty: string;
  groups: (s: GameState) => (TGroup & { sub: string; value: string; unit: string; how: string })[];
  line: (s: GameState) => string;
  panelTitle: string;
  detail?: (s: GameState, rowId: string) => PanelRow[]; // extra read-only rows for the side panel
  focus?: () => string | null; // a row to open on arrival (consumed once)
};

export function listPage(api: GameApi, spec: Spec): { el: HTMLElement; update: () => void } {
  const picks: Record<string, VisState> = {};
  const open = new Set<string>();
  const sort = { key: spec.cols[0].key, dir: 0 as 0 | 1 | -1 };
  const el = h('main');
  const how = h('p', { class: 'how', hidden: true });

  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, spec.title), h('p', { class: 'empty' }, 'No story yet. Create your swordsman first.')); return; }
    const all = spec.groups(s);
    const shown = all.filter((g) => visPass(g.id, picks));
    const onOpen = (id: string) => {
      open.add(id);
      for (const k of Object.keys(picks)) if (k !== id && picks[k] === 'shown') picks[k] = 'off';
      if (picks[id] === 'out') picks[id] = 'off';
      update();
      document.getElementById('grp-' + id)?.scrollIntoView({ block: 'nearest' });
    };
    const onField = (row: TRow, key: string) => openPanel(spec.panelTitle,
      [...spec.cols.map((c) => ({ k: c.title, v: row.cells[c.key] ?? '–', edit: c.key === key })), ...(spec.detail?.(s, row.id) ?? [])],
      'The game changes these through play, so the field is shown read-only here.');
    const want = spec.focus?.();
    if (want) {
      const g = all.find((x) => x.rows.some((r) => r.id === want));
      if (g) { open.add(g.id); delete picks[g.id]; onField(g.rows.find((r) => r.id === want)!, spec.cols[0].key); }
    }
    const picked = Object.entries(picks).filter(([, v]) => v !== 'off');
    const count = shown.reduce((a, g) => a + g.rows.length, 0);
    const hint = picked.length
      ? [h('span', {}, `${plural(count, spec.noun[0], spec.noun[1])} shown · `), h('button', { class: 'hs-btn-text', type: 'button', style: 'min-height:0', onclick: () => { for (const k of Object.keys(picks)) delete picks[k]; update(); } }, 'Clear')]
      : 'Click a box: once for Shown, twice for Left out, three times to clear. Click a heading to open its rows.';
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, spec.title), h('p', {}, spec.intro))),
      h('div', { class: 'sec' },
        all.length ? visTiles(all.map((g) => ({ id: g.id, label: g.title, value: g.value, unit: g.unit, sub: g.sub, how: g.how })), picks, update, onOpen, how) : null,
        h('p', { class: 'subline' }, spec.line(s)), how),
      h('div', { class: 'sec' }, h('div', { class: 'head' }, h('h2', { class: 'hs-section' }, spec.title), h('p', { class: 'hs-note' }, hint)),
        groupedTable({ cols: spec.cols, groups: shown, open, sort, onField, redraw: update, emptyText: picked.length ? `No ${spec.noun[1]} match these boxes. Pick other boxes or Clear.` : spec.empty })));
  }
  return { el, update };
}

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };

export function characterPage(api: GameApi) {
  const el = h('main');
  function update() {
    const s = api.state();
    if (!s) { el.replaceChildren(h('h1', {}, 'Character'), h('p', { class: 'empty' }, 'No story yet. Create your swordsman first.')); return; }
    el.replaceChildren(
      h('div', { class: 'head' }, h('div', {}, h('h1', {}, 'Character'), h('p', {}, 'Who you are and what you can do. Same as /stats.'))),
      h('div', { class: 'cs-split' }, charCard(s, s.player), treeBars(s, s.player)),
      h('p', { class: 'hs-note' }, 'The 8 health segments are the health track, Unhurt to Incapacitated. ✦ marks a tagged skill. Bars are drawn out of 100 for display only; the rules set no skill maximum yet (D-3).'));
  }
  return { el, update };
}

const KIND_GROUP: Record<string, [string, string, string]> = {
  weapon: ['weapons', 'Weapons', 'c10'], shield: ['shields', 'Shields', 'c1'], armor: ['armor', 'Armor', 'c12'],
};
function where(a: Actor, slots: string[] | undefined): string {
  if (!slots?.length) return 'Carried';
  return slots.map((x) => x === 'armor' ? 'Worn' : x.startsWith('hand:') ? `Held · ${x.slice(5).replace('_arm', ' hand')}` : x.startsWith('acc:') ? 'Worn accessory' : x).join(', ');
}

export function inventoryPage(api: GameApi) {
  return listPage(api, {
    title: 'Inventory', intro: 'What you carry. Same as /inv. Click an item for its stats.', noun: ['item', 'items'], panelTitle: 'Item', empty: 'You carry nothing.',
    focus: () => { const id = invFocus.id; invFocus.id = null; return id; },
    detail: (s, id) => {
      const it = s.player.core.inventory.find((i) => i.id === id);
      const d = it ? safe(() => itemDef(s, it.itemId)) : null;
      if (!d) return [];
      const sign = (n = 0) => (n >= 0 ? '+' : '') + n;
      const rows: PanelRow[] = [{ k: 'Look', v: d.look }, { k: 'Kind', v: d.kind }];
      if (d.hands) rows.push({ k: 'Hands', v: String(d.hands) });
      for (const m of d.weapon?.modes ?? []) rows.push({ k: `Attack · ${m.name ?? m.id}`, v: `${m.tree} ${m.class}, reach ${m.reach}, damage ${sign(m.damageAdj)}, hit ${sign(m.hitAdj)}` });
      if (d.armor) rows.push({ k: 'Armor', v: `${d.armor.weight}, covers ${d.armor.covers.join(', ')}, reduction ${d.armor.reduction}, multiplier ×${d.armor.multiplier}` });
      if (d.shield) rows.push({ k: 'Shield pool', v: String(d.shield.pool) });
      for (const e of d.effects ?? []) rows.push({ k: e.kit ? 'Standard kit' : 'Effect', v: `${sign(e.value)} to ${e.kind === 'skill' ? (e.skill === '$mode' ? 'the attack skill' : e.skill) : `${e.roll} rolls`} while ${e.active}${e.kit ? ' (kit pieces share one bonus per roll)' : ''}` });
      rows.push({ k: 'Bulk', v: String(d.bulk) });
      return rows;
    },
    cols: [{ key: 'name', title: 'Item' }, { key: 'where', title: 'Where' }, { key: 'qty', title: 'Qty', right: true }, { key: 'cond', title: 'Condition' }],
    groups: (s) => {
      const p = s.player, groups = new Map<string, TGroup & { sub: string; value: string; unit: string; how: string }>();
      p.core.inventory.filter((i) => i.itemId !== 'coin').forEach((it, n) => {
        const d = safe(() => itemDef(s, it.itemId));
        const [id, title, color] = KIND_GROUP[d?.kind ?? ''] ?? ['other', 'Other', 'c3'];
        const g = groups.get(id) ?? { id, title, color, rows: [], combined: {}, value: '', unit: 'items', sub: '', how: `Everything of this kind you carry.` };
        const pools = it.pools ? Object.entries(it.pools).map(([k, v]) => `${k} ${v}%`).join(', ') : 'Whole';
        g.rows.push({ id: it.id, sortKey: n, cells: { name: d?.name ?? it.itemId, where: where(p, it.equippedIn), qty: String(it.qty ?? 1), cond: pools } });
        groups.set(id, g);
      });
      return [...groups.values()].map((g) => {
        const qty = g.rows.reduce((a, r) => a + +r.cells.qty, 0);
        const ws = [...new Set(g.rows.map((r) => r.cells.where))], cs = [...new Set(g.rows.map((r) => r.cells.cond))];
        const equipped = g.rows.filter((r) => r.cells.where !== 'Carried').length;
        return { ...g, value: String(qty), unit: unitOf(qty, 'item'), sub: `${equipped} in use`, combined: { qty: String(qty), where: ws.length === 1 ? ws[0] : 'Mixed', cond: cs.length === 1 ? cs[0] : 'Mixed' } };
      }).sort((a, b) => (a.id === 'other' ? 1 : 0) - (b.id === 'other' ? 1 : 0) || natural(a.title, b.title));
    },
    line: (s) => {
      const coin = s.player.core.inventory.filter((i) => i.itemId === 'coin').reduce((a, i) => a + (i.qty ?? 1), 0);
      return `Coin ${coin}`;
    },
  });
}

export function questsPage(api: GameApi) {
  return listPage(api, {
    title: 'Quests', intro: 'What you have taken on. Same as /quests.', noun: ['quest', 'quests'], panelTitle: 'Quest', empty: 'No quests yet. Talk to people in the village.',
    cols: [{ key: 'text', title: 'Quest' }, { key: 'state', title: 'State' }],
    groups: (s) => {
      const by = new Map<string, TRow[]>();
      s.quests.forEach((q, i) => { const r = by.get(q.state) ?? []; r.push({ id: q.id, sortKey: i, cells: { text: q.text, state: q.state[0].toUpperCase() + q.state.slice(1) } }); by.set(q.state, r); });
      return [...by.entries()].map(([st, rows]) => ({
        id: st, title: st[0].toUpperCase() + st.slice(1), rows, value: String(rows.length), unit: unitOf(rows.length, 'quest'),
        sub: `latest: ${rows[rows.length - 1].cells.text}`, how: `Quests whose state is ${st}.`, combined: { state: st[0].toUpperCase() + st.slice(1) },
      }));
    },
    line: (s) => `Turn ${s.turn}`,
  });
}
