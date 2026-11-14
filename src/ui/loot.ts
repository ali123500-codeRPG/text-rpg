// Loot: what the character can see to take where they stand, in one pop-up. Bodies that are down (what a search turned up
// and what they wear), open containers and the ground each list their things; the player picks the ones to pocket and
// "Take" types one order for them in the action box, unsent, like the map's Move to here. Built from PlayerView only, so it
// never lists anything the character doesn't know of; whether each take works is still the turn's to decide.
import type { PlayerView } from '../types';
import { isDownLevel } from '../ruleset';
import { cap, listWords, theOf } from '../words';
import { h } from './kit';
import { closePop, openPop } from './pop';

export type LootItem = { id: string; name: string; qty?: number };
/** one place things can be taken from: a body, an open container or the ground; `from` names it in an order ("" = the ground) */
export type LootSource = { key: string; kind: 'body' | 'container' | 'ground'; title: string; from: string; items: LootItem[] };

const theItem = (n: string) => (/^(the|a|an|some)\s/i.test(n) ? theOf(n) : `the ${n}`);

/** everything the character can see to take here, by where it is */
export function lootSources(pv: PlayerView): LootSource[] {
  const out: LootSource[] = [];
  for (const a of pv.actors) {
    if (a.level !== 'full' || a.zone !== pv.zone.id || !a.health || !isDownLevel(a.health)) continue;
    const name = a.name ?? theOf(a.label);
    const items: LootItem[] = [];
    for (const g of a.gear) {
      items.push({ id: g.id, name: g.name });
      if (g.container && !g.container.shut) for (const c of g.container.contents ?? []) items.push({ id: c.id, name: c.name, qty: c.qty });
    }
    if (items.length) out.push({ key: a.id, kind: 'body', title: cap(name), from: name, items });
  }
  const ground: LootItem[] = [];
  for (const g of pv.zone.groundItems) {
    const c = g.container;
    if (c && !c.shut && c.contents?.length) out.push({ key: g.id, kind: 'container', title: cap(g.name), from: theItem(g.name), items: c.contents.map((x) => ({ id: x.id, name: x.name, qty: x.qty })) });
    if (!c?.fixed) ground.push({ id: g.id, name: g.name });
  }
  if (ground.length) out.push({ key: 'ground', kind: 'ground', title: 'On the ground', from: '', items: ground });
  return out;
}

/** how many things there are to take */
export const lootCount = (src: LootSource[]): number => src.reduce((n, s) => n + s.items.length, 0);

/** the order for what was picked, one phrase per place it comes from: "Take the key and the bandage roll from the old
 *  halt-keeper and pick up the rope" */
export function lootOrder(src: LootSource[], picked: ReadonlySet<string>): string {
  const parts = src.map((s) => ({ s, names: s.items.filter((i) => picked.has(i.id)).map((i) => theItem(i.name)) })).filter((p) => p.names.length);
  const phrase = parts.map(({ s, names }, i) => s.kind === 'ground' ? `${i ? 'pick up' : 'Pick up'} ${listWords(names)}` : `${i ? 'take' : 'Take'} ${listWords(names)} from ${s.from}`);
  return listWords(phrase);
}

/** opens the loot pop-up; `onOrder` gets the order to type in the action box. Back closes it */
export function openLoot(pv: PlayerView, opener: HTMLElement | null, onOrder: (order: string) => void): HTMLElement | null {
  const src = lootSources(pv);
  if (!src.length) return null;
  const picked = new Set<string>();
  const take = h('button', { type: 'button', class: 'hs-btn-main loot-take', disabled: true }, 'Take');
  const order = h('p', { class: 'hs-note loot-order', 'aria-live': 'polite' });
  const all = src.flatMap((s) => s.items.map((i) => i.id));
  const allBtn = h('button', { type: 'button', class: 'hs-btn-text loot-all' }, 'Pick all');
  const chips: HTMLButtonElement[] = [];
  const sync = () => {
    for (const c of chips) c.setAttribute('aria-pressed', String(picked.has(c.dataset.item!)));
    const o = lootOrder(src, picked);
    order.textContent = o ? `“${o}”` : 'Pick what to take.';
    take.disabled = !o;
    take.textContent = picked.size ? `Take ${picked.size}` : 'Take';
    allBtn.textContent = picked.size === all.length ? 'Pick none' : 'Pick all';
  };
  const chip = (i: LootItem) => {
    const b = h('button', { type: 'button', class: 'loot-item', 'data-item': i.id, 'aria-pressed': 'false', onclick: () => { if (picked.has(i.id)) picked.delete(i.id); else picked.add(i.id); sync(); } },
      h('span', { class: 'loot-box', 'aria-hidden': 'true' }), h('span', {}, i.name), i.qty && i.qty > 1 ? h('span', { class: 'loot-qty' }, `×${i.qty}`) : '');
    chips.push(b as HTMLButtonElement);
    return b;
  };
  allBtn.onclick = () => { if (picked.size === all.length) picked.clear(); else for (const id of all) picked.add(id); sync(); };
  take.onclick = () => { const o = lootOrder(src, picked); if (!o) return; closePop(); onOrder(o); };
  const body = [
    ...src.map((s) => h('section', { class: 'loot-src', 'data-src': s.kind }, h('h3', { class: 'loot-h' }, s.title), h('div', { class: 'loot-items' }, ...s.items.map(chip)))),
    h('div', { class: 'loot-foot' }, order, h('div', { class: 'loot-btns' }, allBtn, take)),
  ];
  sync();
  return openPop({ title: 'Loot', body, opener, cls: 'loot-pop', back: true });
}
