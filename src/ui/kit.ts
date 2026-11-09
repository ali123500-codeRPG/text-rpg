// Small DOM helpers and the shared HISAB pieces: readout tiles, visibility tiles, grouped tables, side panel.
type Attrs = Record<string, unknown>;
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** Dates are DD/MM/YYYY (project rule). */
export function fmtDate(iso: string | number | Date | undefined): string {
  if (iso === undefined) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${unitOf(n, one, many)}`;
export const unitOf = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);

// ---------- Readout tiles (every tile: label, figure + unit, one sub-line, ⓘ at the end of the sub-line) ----------
export type Readout = { label: string; value: string; unit?: string; sub: string; how: string; tone?: 'ok' | 'warn' };

export function readouts(items: Readout[], howEl: HTMLElement): HTMLElement {
  return h('div', { class: 'hs-readouts' }, items.map((r) =>
    h('div', { class: 'hs-readout' },
      h('p', { class: 'hs-label' }, r.label),
      h('div', { class: 'v' + (r.tone ? ' ' + r.tone : '') }, r.value, r.unit ? h('small', {}, r.unit) : null),
      h('div', { class: 'sub' }, h('span', {}, r.sub),
        h('button', { class: 'hs-ro-i', type: 'button', title: `How it’s worked out · ${r.label}`, 'aria-label': `How it’s worked out · ${r.label}`,
          onclick: () => { howEl.replaceChildren(h('b', {}, `How it’s worked out · ${r.label}: `), r.how); howEl.hidden = false; } }, 'ⓘ')))));
}

// ---------- Visibility tiles: big box cycles Shown → Left out → off; heading opens the group ----------
export type VisState = 'shown' | 'out' | 'off';
export type VisTile = { id: string; label: string; value: string; unit: string; sub: string; how: string };
const NEXT: Record<VisState, VisState> = { off: 'shown', shown: 'out', out: 'off' };
const NEXT_TIP: Record<VisState, string> = { off: 'Click for Shown (several Shown = either)', shown: 'Click for Left out', out: 'Click to clear' };

export function visTiles(tiles: VisTile[], picks: Record<string, VisState>, onChange: () => void, onOpen: (id: string) => void, howEl: HTMLElement): HTMLElement {
  return h('div', { class: 'hs-readouts' }, tiles.map((t) => {
    const st = picks[t.id] ?? 'off';
    return h('div', { class: 'hs-readout vis', 'data-st': st },
      h('button', { class: 'hd', type: 'button', title: `Open ${t.label}`, onclick: () => onOpen(t.id) }, h('span', { class: 'hs-label' }, `${t.label} ›`)),
      h('button', { class: 'box', type: 'button', title: NEXT_TIP[st], 'aria-pressed': st === 'shown' ? 'true' : st === 'out' ? 'mixed' : 'false',
        onclick: () => { picks[t.id] = NEXT[st]; onChange(); } },
        h('div', { class: 'v' }, t.value, h('small', {}, t.unit), st === 'shown' ? h('span', { class: 'st' }, 'Shown') : st === 'out' ? h('span', { class: 'st' }, 'Left out') : null),
        h('div', { class: 'sub' }, h('span', {}, st === 'out' ? 'left out' : t.sub))),
      h('button', { class: 'hs-ro-i vis-i', type: 'button', title: `How it’s worked out · ${t.label}`, 'aria-label': `How it’s worked out · ${t.label}`,
        onclick: () => { howEl.replaceChildren(h('b', {}, `How it’s worked out · ${t.label}: `), t.how); howEl.hidden = false; } }, 'ⓘ'));
  }));
}

/** Rows pass the filter: any Shown group matches (either), Left out groups never match. */
export function visPass(group: string, picks: Record<string, VisState>): boolean {
  if (picks[group] === 'out') return false;
  const shown = Object.entries(picks).filter(([, s]) => s === 'shown').map(([k]) => k);
  return shown.length === 0 || shown.includes(group);
}

// ---------- Grouped table ----------
export type Col = { key: string; title: string; right?: boolean };
/** tones: a per-cell colour (bad = red, muted = grey), e.g. the inventory's Needs column (EQ7) */
export type TRow = { id: string; cells: Record<string, string>; sortKey?: number; tones?: Record<string, 'bad' | 'muted'> };
export type TGroup = { id: string; title: string; color?: string; rows: TRow[]; combined: Record<string, string>; combinedTones?: Record<string, 'bad' | 'muted'> };

/** natural-number title order: "Slime 2" before "Slime 10" */
export const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function groupedTable(opts: {
  cols: Col[]; groups: TGroup[]; open: Set<string>; sort: { key: string; dir: 0 | 1 | -1 };
  onField: (row: TRow, key: string) => void; redraw: () => void; emptyText: string;
}): HTMLElement {
  const { cols, groups, open, sort } = opts;
  if (!groups.length) return h('p', { class: 'empty' }, opts.emptyText);
  const cmp = (a: TRow, b: TRow) => {
    if (!sort.dir) return (a.sortKey ?? 0) - (b.sortKey ?? 0);
    const x = a.cells[sort.key] ?? '', y = b.cells[sort.key] ?? '';
    const nx = Number(x), ny = Number(y);
    // 1st click: biggest first for numbers, A–Z for words; 2nd click reverses
    const c = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '' ? ny - nx : natural(x, y);
    return sort.dir === 1 ? c : -c;
  };
  const th = cols.map((c) => h('th', { class: (c.right ? 'r ' : '') + (sort.key === c.key && sort.dir ? 'sorted' : ''), title: 'Sort',
    onclick: () => { if (sort.key !== c.key) { sort.key = c.key; sort.dir = 1; } else sort.dir = sort.dir === 1 ? -1 : sort.dir === -1 ? 0 : 1; opts.redraw(); } },
    c.title, sort.key === c.key && sort.dir ? h('span', { class: 'ar' }, sort.dir === 1 ? '↓' : '↑') : null));
  const body = h('tbody');
  for (const g of groups) {
    const rows = [...g.rows].sort(cmp);
    const single = rows.length === 1;
    const toggle = () => { open.has(g.id) ? open.delete(g.id) : open.add(g.id); opts.redraw(); };
    if (single) { body.append(dataRow(rows[0], cols, opts.onField, null, g)); continue; }
    const isOpen = open.has(g.id);
    body.append(h('tr', { class: 'grp', id: 'grp-' + g.id, onclick: (e: Event) => { if (!(e.target as HTMLElement).closest('.fld')) toggle(); } },
      cols.map((c, i) => h('td', { class: c.right ? 'r' : '' },
        i === 0 ? [h('span', { class: 'hs-chev' }, isOpen ? '⌄' : '›'), g.color ? h('i', { class: 'hs-sq', style: `background:var(--${g.color})` }) : null, g.title,
          h('button', { class: 'hs-chip', type: 'button', title: isOpen ? 'Fold the rows' : `Open the ${rows.length} rows`, onclick: (e: Event) => { e.stopPropagation(); toggle(); } }, `↻${rows.length}`)]
          : g.combinedTones?.[c.key] ? h('span', { class: 'tone-' + g.combinedTones[c.key] }, g.combined[c.key] ?? '') : g.combined[c.key] ?? ''))));
    if (isOpen) rows.forEach((r, i) => body.append(dataRow(r, cols, opts.onField, i + 1, g)));
  }
  return h('table', { class: 'hs-tbl' }, h('thead', {}, h('tr', {}, th)), body);
}

function dataRow(r: TRow, cols: Col[], onField: (row: TRow, key: string) => void, n: number | null, g: TGroup): HTMLElement {
  return h('tr', {}, cols.map((c, i) => h('td', { class: c.right ? 'r' : '' },
    i === 0 && n !== null ? h('span', { class: 'sn' }, `${n}.`) : null,
    i === 0 && n === null && g.color ? h('i', { class: 'hs-sq', style: `background:var(--${g.color})` }) : null,
    h('span', { class: 'fld' + (r.tones?.[c.key] ? ' tone-' + r.tones[c.key] : ''), onclick: () => onField(r, c.key) }, r.cells[c.key] ?? '–'))));
}

// ---------- Side panel ----------
export type PanelRow = { k: string; v: string | Node; edit?: boolean };
let panelHost: HTMLElement | null = null;
export function setPanelHost(el: HTMLElement) { panelHost = el; }
export function closePanel() { if (panelHost) { panelHost.hidden = true; panelHost.replaceChildren(); } }
export function openPanel(title: string, rows: PanelRow[], note?: string) {
  if (!panelHost) return;
  panelHost.hidden = false;
  panelHost.replaceChildren(
    h('div', { class: 'hs-panel-head' }, h('span', {}, title), h('button', { class: 'hs-icon-btn', type: 'button', 'aria-label': 'Close', title: 'Close', onclick: closePanel }, '×')),
    ...rows.map((r) => h('div', { class: 'hs-panel-row' + (r.edit ? ' edit' : '') }, h('span', { class: 'k' }, r.k),
      r.edit && typeof r.v === 'string' ? h('input', { class: 'hs-input', value: r.v, readOnly: true, 'aria-label': r.k }) : h('span', {}, r.v))),
    note ? h('p', { class: 'hs-note', style: 'padding-top:12px' }, note) : '',
  );
  (panelHost.querySelector('.edit input') as HTMLInputElement | null)?.focus();
}

