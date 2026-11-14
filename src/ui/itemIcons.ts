// Item and class icons: one filled silhouette per kind of thing (IC1-IC3), from src/ui/iconArt.ts (made by scripts/icons.mjs),
// tinted by item kind in CSS (IC4). A library item picks its icon through ICON_OF (by IT id); a minted item uses its base
// item's; anything not listed falls back on its kind, so a new item shows a sensible icon before it gets its own entry.
// Items sharing a type share an icon. A class picks its icon through CLASS_ICON; a Start shows its class's.
import type { GameState } from '../types';
import { itemDef } from '../library';
import { IT } from '../library/itemIds';
import { CL } from '../library/classIds';
import { ICON_ART, type IconName } from './iconArt';
import { instanceItem } from '../views';

export const ICONS = ICON_ART;
/** IC5: the credit the icons' licence asks for, shown on the GM page */
export const ICON_CREDIT = 'Icon credits: game-icons.net by Lorc, Delapouite and contributors (CC BY 3.0); Fluent Emoji High Contrast by Microsoft (MIT).';
export type { IconName };

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
  [IT.crude_clothes]: 'tunic', [IT.gambeson]: 'tunic', [IT.boiled_leather]: 'leather', [IT.mail_hauberk]: 'mail',
  [IT.brigandine]: 'plate', [IT.lamellar_coat]: 'plate', [IT.plate_harness]: 'plate', [IT.half_plate]: 'plate',
  [IT.signet_ring]: 'ring', [IT.varos_loop]: 'earring', [IT.lucky_charm]: 'charm', [IT.lockpicks]: 'picks', [IT.key]: 'key',
  [IT.healing_draught]: 'potion', [IT.bandage]: 'bandage', [IT.curio]: 'pouch', [IT.coin]: 'coin',
  [IT.pack]: 'pack', [IT.sack]: 'sack', [IT.chest]: 'chest', [IT.crate]: 'crate',
};
const CLASS_ICON: Record<string, IconName> = {
  [CL.swordsman]: 'swordsman', [CL.late_bloomer]: 'late_bloomer', [CL.sword_dancer]: 'sword_dancer', [CL.commoner]: 'commoner',
  [CL.a_nobody]: 'a_nobody', [CL.trader]: 'trader', [CL.merchant]: 'merchant', [CL.guard]: 'guard',
  [CL.threadbounded]: 'threadbounded', [CL.blessed_by_imbra]: 'blessed',
};
/** a class's icon; a class not listed yet shows the Commoner's */
export const classIconName = (classId: string): IconName => CLASS_ICON[classId] ?? 'commoner';
const BY_KIND: Record<string, IconName> = {
  weapon: 'sword', shield: 'shield', armor: 'tunic', accessory: 'ring', tool: 'picks', consumable: 'potion', misc: 'pouch',
};

export function iconName(s: GameState, itemId: string): IconName {
  let d: ReturnType<typeof itemDef> | null = null;
  try { d = itemDef(s, itemId); } catch { return 'pouch'; }
  return ICON_OF[d.id] ?? (d.base ? ICON_OF[d.base.itemId] : undefined) ?? BY_KIND[d.kind] ?? 'pouch';
}

/** the icon in a span; kind tints it (data-kind matches the Inventory's group colours); `cls` sizes it (iico, cico) */
export function itemIcon(name: IconName, kind?: string, cls = 'iico'): HTMLElement {
  const el = document.createElement('span');
  el.className = cls;
  if (kind) el.dataset.kind = kind;
  el.innerHTML = ICONS[name];
  return el;
}

/** the icon of an item instance anyone carries or that lies about (the loot pop-up), tinted by its kind; null if gone */
export function instanceIcon(s: GameState, instanceId: string, cls?: string): HTMLElement | null {
  const itemId = instanceItem(s, instanceId);
  if (!itemId) return null;
  let kind: string | undefined;
  try { kind = itemDef(s, itemId).kind; } catch { kind = undefined; }
  return itemIcon(iconName(s, itemId), kind, cls);
}

/** a class's icon, small, beside its name (class tree, Character page, the Starts on the creation screen) */
export const classIcon = (classId: string): HTMLElement => itemIcon(classIconName(classId), undefined, 'cico');
/** a Start's icon: its class's; a Start whose class comes from a god's blessing (The Blessed) shows the blessing */
export const startIcon = (start: { classId?: string }): HTMLElement => (start.classId ? classIcon(start.classId) : itemIcon('blessed', undefined, 'cico'));
