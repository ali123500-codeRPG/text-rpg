// Healing displays (Ali, 07/11/2026): H1 d, the "Patched up" card with coloured state tags and a health-track bar
// whose healed segment glows; H3 b, one quick-use slot beside Aim for a healing item, picked in the Inventory
// (default: the strongest, ties to the one carried most). H2 a (the healed body part glows) is in charsheet.ts.
import type { Actor, GameState, HealNote, HealingDef } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from '../library';
import { h } from './kit';

const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const partName = (id: string) => cap(id.replace(/_/g, ' '));

/** a health level's or part state's colour class: by its position in its names table */
const LEVELS = () => CONFIG.HEALTH_TRACK.map(([l]) => l);
const PART_STATES = ['Healthy', 'Damaged', 'Crippled', 'Destroyed'];
const lvTag = (l: string) => h('span', { class: `htag lv${Math.max(0, LEVELS().indexOf(l))}` }, l);
const psTag = (st: string) => h('span', { class: `htag ps${Math.max(0, PART_STATES.indexOf(st))}` }, st);
const arrow = () => h('span', { class: 'ar', 'aria-hidden': 'true' }, '→');

const TITLE: Record<string, string> = { rest: 'Rested', clinic: 'Treated' };

/** health track: segments from Unhurt up to the level now, each in its level's colour; the healed one glows and the
 * levels healed away are dashed */
function trackBar(n: HealNote): HTMLElement {
  const lv = LEVELS(), to = Math.max(0, lv.indexOf(n.to)), from = Math.max(0, lv.indexOf(n.from));
  return h('span', { class: 'hseg', title: `Health: ${n.from === n.to ? n.to : `${n.from} → ${n.to}`}`, 'aria-hidden': 'true' },
    lv.map((_, i) => h('i', { class: i <= to ? `lv${i}${i === to && from > to ? ' new' : ''}` : i <= from ? 'lost' : '' })));
}

/** healing rows that show as a quiet line instead of a card (T3 b, Ali 07/11/2026): healing the player didn't choose */
const QUIET = new Set(['passive']);

export function healCard(n: HealNote): HTMLElement {
  const name = getLibrary().healing?.[n.source]?.name ?? cap(n.source);
  const bits: (HTMLElement | string)[] = [h('span', { class: 'src' }, name)];
  if (n.from !== n.to) bits.push(lvTag(n.from), arrow(), lvTag(n.to));
  for (const p of n.parts) bits.push(h('span', { class: 'pt' }, `· ${partName(p.id).toLowerCase()}`), psTag(p.from), arrow(), psTag(p.to));
  if (n.from === n.to && !n.parts.length) bits.push(h('span', { class: 'pt' }, n.better ? '· a little better' : '· no change'));
  if (QUIET.has(n.source)) return h('p', { class: 'hquiet', role: 'status' }, h('span', { class: 'x', 'aria-hidden': 'true' }, '✚'), bits);
  return h('div', { class: 'hcard', role: 'status' }, h('span', { class: 'x', 'aria-hidden': 'true' }, '✚'),
    h('div', {}, TITLE[n.source] ?? 'Patched up', h('p', { class: 'hl' }, bits)), trackBar(n));
}

// ---------------- quick slot (H3) ----------------

export type HealItem = { itemId: string; name: string; count: number; row: HealingDef };
const strength = (r: HealingDef) => r.hpPct + r.partPct;

/** healing items carried, grouped by item, strongest first (ties: the one carried most) */
export function healItems(s: GameState, p: Actor): HealItem[] {
  const by = new Map<string, HealItem>();
  for (const i of p.core.inventory) {
    const d = safe(() => itemDef(s, i.itemId));
    const row = d?.heal ? getLibrary().healing?.[d.heal] : undefined;
    if (!d || !row) continue;
    const it = by.get(i.itemId) ?? { itemId: i.itemId, name: d.name, count: 0, row };
    it.count += i.qty ?? 1;
    by.set(i.itemId, it);
  }
  return [...by.values()].sort((a, b) => strength(b.row) - strength(a.row) || b.count - a.count);
}

/** the item the quick slot shows: the player's pick while they still carry it, else the strongest */
export function quickHeal(s: GameState, p: Actor): HealItem | null {
  const all = healItems(s, p);
  return all.find((x) => x.itemId === p.progression?.quickHeal) ?? all[0] ?? null;
}

const BANDAGE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-45 12 12)"><rect x="2" y="8" width="20" height="8" rx="4" fill="#e9d2b0" stroke="#b99a72"/><rect x="9" y="8" width="6" height="8" fill="#f6ead6" stroke="#b99a72"/><circle cx="11" cy="10.6" r=".6" fill="#b99a72"/><circle cx="13" cy="10.6" r=".6" fill="#b99a72"/><circle cx="11" cy="13.4" r=".6" fill="#b99a72"/><circle cx="13" cy="13.4" r=".6" fill="#b99a72"/></g></svg>';
const VIAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9.5" y="2.5" width="5" height="3" rx="1" fill="#a07a52"/><path d="M10 5.5h4v3.2c2.9 1 5 3.7 5 6.8a7 7 0 0 1-14 0c0-3.1 2.1-5.8 5-6.8z" fill="#5fd38a55" stroke="#9ff0bd" stroke-width="1.2"/><path d="M6.4 15h11.2a5.6 5.6 0 0 1-11.2 0z" fill="#5fd38a"/></svg>';
/** an item's icon: by healing source for now (a library icon field can replace this) */
export function healIcon(it: HealItem): HTMLElement {
  const el = h('span', { class: 'hico' });
  el.innerHTML = it.row.id === 'bandage' ? BANDAGE : VIAL;
  return el;
}
