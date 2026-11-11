// Item icons for the Inventory's equipment panel: one line drawing per kind of thing, tinted by item kind in CSS.
// A library item picks its drawing through ICON_OF (by IT id); a minted item uses its base item's; anything not listed
// falls back on its kind, so a new item shows a sensible icon before it gets its own entry.
import type { GameState } from '../types';
import { itemDef } from '../library';
import { IT } from '../library/itemIds';

const P = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  sword: P('<path d="M20 4v3L9.5 17.5l-3-3L17 4z"/><path d="M5 13l6 6"/><path d="M7.5 16.5 4 20"/><circle cx="3.6" cy="20.4" r=".9"/>'),
  dagger: P('<path d="M18 6v2.6l-6 6-2.6-2.6 6-6z"/><path d="M8 11.5l4.5 4.5"/><path d="M9.6 15.4 6 19"/><circle cx="5.4" cy="19.6" r=".9"/>'),
  axe: P('<path d="M4 20 15.5 8.5"/><path d="M12.5 5.5c2.6-1.8 5.6-1.6 7.5.4.4 2.6-.6 5.4-2.8 7.4z"/>'),
  spear: P('<path d="M3.5 20.5 15 9"/><path d="M14 10 15.6 5 20 4l-1 4.4z"/><path d="M12.5 9.5l2 2"/>'),
  bow: P('<path d="M5 3.5Q19.5 4.5 20.5 19"/><path d="M5 3.5 20.5 19"/><path d="M9 12.5h6.5M13.5 10.5l2 2-2 2"/>'),
  crossbow: P('<path d="M12 21V7"/><path d="M4 9.5Q12 3 20 9.5"/><path d="M4 9.5 12 13l8-3.5"/><path d="M10.5 18h3"/>'),
  club: P('<path d="M5 19.5 12 12.5"/><path d="M11 9.5a3.8 3.8 0 1 1 4.5 4.5l-2.5 1.2-3.2-3.2z"/>'),
  shield: P('<path d="M12 3 5 5.8v5.4c0 4.8 3 7.9 7 9.8 4-1.9 7-5 7-9.8V5.8z"/><path d="M12 3v18M5.6 10.5h12.8"/>'),
  tunic: P('<path d="M9 3.5 4 6.5l2 4 2-1V20.5h8V9.5l2 1 2-4-5-3c0 1.4-1.3 2.4-3 2.4S9 4.9 9 3.5z"/>'),
  cuirass: P('<path d="M7 4h10l2.5 4-2.5 2v10.5H7V10L4.5 8z"/><path d="M7 10.5h10M12 10.5v10M9.5 4c.4 1.8 1.2 2.6 2.5 2.6s2.1-.8 2.5-2.6"/>'),
  ring: P('<circle cx="12" cy="14.5" r="5.5"/><path d="M9.6 9.6 12 5l2.4 4.6"/><path d="M10.8 5h2.4"/>'),
  charm: P('<path d="M7.5 3.5c.5 3.2 2.2 4.8 4.5 4.8s4-1.6 4.5-4.8"/><circle cx="12" cy="14" r="5"/><path d="M12 11v6M9 14h6"/>'),
  picks: P('<path d="M4 20 14.5 9.5"/><path d="M14.5 9.5h3v-3"/><path d="M7.5 20.5 17.5 10.5l2.5.6"/>'),
  potion: P('<path d="M10 3h4"/><path d="M10.6 3v4.6a6.2 6.2 0 1 0 2.8 0V3"/><path d="M6.6 15h10.8"/>'),
  bandage: P('<rect x="2.8" y="8.8" width="18.4" height="6.4" rx="3.2" transform="rotate(-38 12 12)"/><path d="M10 9.6l4 4.8M8.6 11.2l4 4.8" stroke-width="1.2"/>'),
  pouch: P('<path d="M8 5.5h8l-1.6 2.6c2.6 1.6 4.6 4.1 4.6 7.4a4.8 4.8 0 0 1-4.8 4.8H9.8A4.8 4.8 0 0 1 5 15.5c0-3.3 2-5.8 4.6-7.4z"/><path d="M9.6 8.1h4.8"/>'),
} as const;
export type IconName = keyof typeof ICONS;

/** a library item's own drawing; items not listed fall back on their kind (BY_KIND) */
const ICON_OF: Record<string, IconName> = {
  [IT.arming_sword]: 'sword', [IT.basket_hilt_sword]: 'sword', [IT.short_sword]: 'sword', [IT.greatsword]: 'sword',
  [IT.dagger]: 'dagger', [IT.hidden_blade]: 'dagger', [IT.rusty_knife]: 'dagger',
  [IT.greataxe]: 'axe', [IT.hand_axe]: 'axe', [IT.woodsman_axe]: 'axe',
  [IT.spear]: 'spear',
  [IT.shortbow]: 'bow', [IT.longbow]: 'bow', [IT.recurve_bow]: 'bow', [IT.flatbow]: 'bow',
  [IT.crossbow]: 'crossbow', [IT.light_crossbow]: 'crossbow', [IT.stirrup_crossbow]: 'crossbow',
  [IT.cudgel]: 'club', [IT.improvised_light]: 'club', [IT.improvised_medium]: 'club', [IT.improvised_heavy]: 'club',
  [IT.round_shield]: 'shield', [IT.kite_shield]: 'shield',
  [IT.crude_clothes]: 'tunic', [IT.gambeson]: 'tunic', [IT.boiled_leather]: 'tunic',
  [IT.mail_hauberk]: 'cuirass', [IT.brigandine]: 'cuirass', [IT.lamellar_coat]: 'cuirass', [IT.plate_harness]: 'cuirass', [IT.half_plate]: 'cuirass',
  [IT.signet_ring]: 'ring', [IT.lucky_charm]: 'charm', [IT.lockpicks]: 'picks',
  [IT.healing_draught]: 'potion', [IT.bandage]: 'bandage', [IT.curio]: 'pouch',
};
const BY_KIND: Record<string, IconName> = {
  weapon: 'sword', shield: 'shield', armor: 'tunic', accessory: 'ring', tool: 'picks', consumable: 'potion', misc: 'pouch',
};

export function iconName(s: GameState, itemId: string): IconName {
  let d: ReturnType<typeof itemDef> | null = null;
  try { d = itemDef(s, itemId); } catch { return 'pouch'; }
  return ICON_OF[d.id] ?? (d.base ? ICON_OF[d.base.itemId] : undefined) ?? BY_KIND[d.kind] ?? 'pouch';
}

/** the drawing in a span; kind tints it (data-kind matches the Inventory's group colours) */
export function itemIcon(name: IconName, kind?: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'iico';
  if (kind) el.dataset.kind = kind;
  el.innerHTML = ICONS[name];
  return el;
}
