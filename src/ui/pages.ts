// Character (/stats), Inventory (/inv) and Quests (/quests): the same page shape. Visibility tiles on top (one per group),
// figures that can't be filtered in a text line under them, then the grouped table.
import type { Actor, GameApi, GameState } from '../types';
import { getLibrary, itemDef } from '../library';
import { totalHp } from '../ruleset';
import { credit, groupedTable, h, natural, openPanel, plural, unitOf, visPass, visTiles, type Col, type TGroup, type TRow, type VisState } from './kit';
import { skillName, TREE_VIEW } from './creation';

type Spec = {
  title: string; intro: string; noun: [string, string]; cols: Col[]; empty: string;
  groups: (s: GameState) => (TGroup & { sub: string; value: string; unit: string; how: string })[];
  line: (s: GameState) => string;
  panelTitle: string;
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
      spec.cols.map((c) => ({ k: c.title, v: row.cells[c.key] ?? '–', edit: c.key === key })),
      'The game changes these through play, so the field is shown read-only here.');
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
        groupedTable({ cols: spec.cols, groups: shown, open, sort, onField, redraw: update, emptyText: picked.length ? `No ${spec.noun[1]} match these boxes. Pick other boxes or Clear.` : spec.empty })),
      credit());
  }
  return { el, update };
}

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const STATE_WORD: Record<string, string> = { tagged: 'Tagged', normal: 'Normal', flawed: 'Flawed' };

export function characterPage(api: GameApi) {
  return listPage(api, {
    title: 'Character', intro: 'Your skills by tree. Same as /stats.', noun: ['skill', 'skills'], panelTitle: 'Skill', empty: 'No skills yet.',
    cols: [{ key: 'name', title: 'Skill' }, { key: 'raw', title: 'Raw', right: true }, { key: 'state', title: 'State' }],
    groups: (s) => {
      const lib = getLibrary(), p = s.player;
      return TREE_VIEW.filter((t) => lib.trees[t.id]).map((t) => {
        const rows: TRow[] = lib.trees[t.id].skills.filter((k) => p.core.skills[k]).map((k, i) => {
          const e = p.core.skills[k];
          return { id: k, sortKey: i, cells: { name: skillName(k), raw: String(e.raw), state: STATE_WORD[e.state] ?? e.state } };
        });
        const sum = rows.reduce((a, r) => a + +r.cells.raw, 0);
        const states = [...new Set(rows.map((r) => r.cells.state))];
        const top = [...rows].sort((a, b) => +b.cells.raw - +a.cells.raw)[0];
        return { id: t.id, title: lib.trees[t.id].name, color: t.c, rows, value: String(sum), unit: 'pts',
          sub: top ? `${plural(rows.length, 'skill')} · top ${top.cells.name} ${top.cells.raw}` : 'No points here',
          how: 'The sum of your raw skills in this tree.',
          combined: { raw: String(sum), state: states.length === 1 ? states[0] : 'Mixed' } };
      }).filter((g) => g.rows.length);
    },
    line: (s) => {
      const p = s.player, hp = safe(() => totalHp(s, p));
      return `HP ${hp ?? '—'} · standing defense ${p.core.standingDefense} · Potential ${p.progression?.potential.base ?? '–'} · StartingTotal ${p.progression?.startingTotal ?? '–'}`;
    },
  });
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
    title: 'Inventory', intro: 'What you carry. Same as /inv.', noun: ['item', 'items'], panelTitle: 'Item', empty: 'You carry nothing.',
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
      }).sort((a, b) => natural(a.title, b.title));
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
      s.quests.forEach((q, i) => { const r = by.get(q.state) ?? []; r.push({ id: q.id, sortKey: i, cells: { text: q.text, state: q.state } }); by.set(q.state, r); });
      return [...by.entries()].map(([st, rows]) => ({
        id: st, title: st[0].toUpperCase() + st.slice(1), rows, value: String(rows.length), unit: unitOf(rows.length, 'quest'),
        sub: `latest: ${rows[rows.length - 1].cells.text}`, how: `Quests whose state is ${st}.`, combined: { state: st },
      }));
    },
    line: (s) => `Turn ${s.turn}`,
  });
}
