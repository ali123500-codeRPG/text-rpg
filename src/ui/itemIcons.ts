// Item and class icons: one filled silhouette per kind of thing (IC1-IC3), from src/ui/iconArt.ts (made by scripts/icons.mjs),
// tinted by item kind in CSS (IC4). A library item picks its icon through ICON_OF (by IT id); a minted item uses its base
// item's; anything not listed falls back on its kind, so a new item shows a sensible icon before it gets its own entry.
// Items sharing a type share an icon. A class picks its icon through CLASS_ICON; a Start shows its class's.
import type { GameState } from '../types';
import { itemDef } from '../library';
import { IT } from '../library/itemIds';
import { CL } from '../library/classIds';
import { SK } from '../library/skillIds';
import { TR } from '../library/treeIds';
import { BT, RC } from '../library/raceIds';
import { ICON_ART, type IconName } from './iconArt';
import { instanceItem } from '../views';

export const ICONS = ICON_ART;
/** IC5: the credit the icons' licence asks for, shown on the GM page */
export const ICON_CREDIT = 'Icon credits: game-icons.net by Lorc, Delapouite and contributors (CC BY 3.0); Fluent Emoji High Contrast by Microsoft (MIT); Material Symbols by Google (Apache-2.0).';
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
  [IT.varos_loop]: 'charm', [IT.lucky_charm]: 'charm', [IT.lockpicks]: 'picks', [IT.key]: 'key',
  [IT.healing_draught]: 'potion', [IT.bandage]: 'bandage', [IT.curio]: 'pouch', [IT.coin]: 'coin',
  [IT.pack]: 'pack', [IT.sack]: 'sack', [IT.chest]: 'chest', [IT.crate]: 'crate',
};
const CLASS_ICON: Record<string, IconName> = {
  [CL.swordsman]: 'swordsman', [CL.late_bloomer]: 'late_bloomer', [CL.sword_dancer]: 'sword_dancer', [CL.commoner]: 'commoner',
  [CL.a_nobody]: 'a_nobody', [CL.a_somebody]: 'a_somebody', [CL.trader]: 'trader', [CL.merchant]: 'merchant', [CL.guard]: 'guard',
  [CL.threadbounded]: 'threadbounded', [CL.blessed_by_imbra]: 'blessed', [CL.knight]: 'plate', [CL.knight_trainee]: 'plate', // NR13: plate until it has art of its own
};
/** MAP-69: what someone is, by race, when nothing they hold or wear stands out; a race not listed falls back on its body */
const RACE_ICON: Record<string, IconName> = {
  [RC.human]: 'person', [RC.elf]: 'person', [RC.slime]: 'slime', [RC.dragon]: 'dragon', [RC.dog]: 'dog', [RC.wolf]: 'wolf',
  [RC.tiger]: 'big_cat', [RC.leopard]: 'big_cat', [RC.lion]: 'lion', [RC.bear]: 'bear', [RC.boar]: 'boar', [RC.horse]: 'horse',
  [RC.hyena]: 'hyena', [RC.lizard]: 'lizard', [RC.crocodile]: 'lizard', [RC.python]: 'snake', [RC.spider]: 'spider',
};
const BODY_ICON: Record<string, IconName> = { [BT.amorphous]: 'slime', [BT.quadruped]: 'beast', [BT.winged_quadruped]: 'dragon', [BT.serpent]: 'snake', [BT.eight_legged]: 'spider' };
/** MAP-69: the icon of what someone is, from the race and body seen */
export const kindIconName = (raceId: string | undefined, bodyTypeId: string | undefined): IconName => (raceId && RACE_ICON[raceId]) || (bodyTypeId && BODY_ICON[bodyTypeId]) || 'person';
/** a class's icon; a class not listed yet shows the Commoner's */
export const classIconName = (classId: string): IconName => CLASS_ICON[classId] ?? 'commoner';
/** a skill tree's icon, large in its band's heading in place of its name; Sword Dancer and Merchant share their class's */
const TREE_ICON: Record<string, IconName> = {
  [TR.melee]: 'tr_melee', [TR.defense]: 'tr_defense', [TR.fortitude]: 'tr_fortitude', [TR.armor]: 'tr_armor', [TR.swordsman]: 'tr_swordsman',
  [TR.perception]: 'tr_perception', [TR.ranged]: 'tr_ranged', [TR.unarmed]: 'tr_unarmed', [TR.stealth]: 'tr_stealth', [TR.speech]: 'tr_speech',
  [TR.trickery]: 'tr_trickery', [TR.natural]: 'tr_natural', [TR.slime_senses]: 'tr_slime_senses', [TR.tools]: 'tr_tools',
  [TR.sword_dancer]: 'sword_dancer', [TR.merchant]: 'merchant', [TR.medicine]: 'tr_medicine', [TR.tactics]: 'tr_tactics',
};
/** a tree's icon in place of its name, which is its tip and accessible name; null for a tree with no icon yet */
export const treeIcon = (treeId: string, name: string): HTMLElement | null => {
  if (!TREE_ICON[treeId]) return null;
  const el = itemIcon(TREE_ICON[treeId], undefined, 'trico');
  el.setAttribute('role', 'img'); el.title = name; el.setAttribute('aria-label', name);
  return el;
};
/** a skill's icon: the item or class icon it shares where one fits, else its own sk_ pick */
const SKILL_ICON: Record<string, IconName> = {
  [SK.melee_light]: 'dagger', [SK.melee_medium]: 'sword', [SK.melee_heavy]: 'axe', [SK.ranged_light]: 'sk_ranged_light', [SK.ranged_medium]: 'bow', [SK.ranged_heavy]: 'crossbow',
  [SK.unarmed_strike]: 'sk_strike', [SK.unarmed_grapple]: 'sk_grapple', [SK.unarmed_improvised]: 'sk_improvised', [SK.slam]: 'sk_slam',
  [SK.dodge]: 'sk_dodge', [SK.block]: 'shield', [SK.endurance]: 'sk_endurance', [SK.eyesight]: 'sk_eyesight', [SK.earshot]: 'sk_earshot',
  [SK.sneaking]: 'sk_sneaking', [SK.combat_stealth]: 'sk_combat_stealth', [SK.vanishing]: 'sk_vanishing', [SK.persuasion]: 'sk_persuasion',
  [SK.intimidation]: 'sk_intimidation', [SK.barter]: 'coin', [SK.riposte]: 'sk_riposte', [SK.light_armor]: 'leather', [SK.medium_armor]: 'mail',
  [SK.heavy_armor]: 'plate', [SK.tremor]: 'sk_tremor', [SK.lockpicking]: 'picks', [SK.blade_dance]: 'sword_dancer', [SK.falsehood]: 'sk_falsehood',
  [SK.insight]: 'sk_insight', [SK.shrewd_dealing]: 'sk_shrewd_dealing', [SK.resolve]: 'sk_resolve', [SK.parry]: 'sk_parry', [SK.filching]: 'sk_filching',
  [SK.stamina]: 'sk_stamina', [SK.bite]: 'sk_bite', [SK.claws]: 'sk_claws', [SK.hooves_horns]: 'sk_hooves_horns', [SK.tail]: 'sk_tail',
  [SK.scent]: 'sk_scent', [SK.hide]: 'sk_hide', [SK.healing]: 'sk_healing', [SK.battle_sense]: 'sk_battle_sense', [SK.command]: 'sk_command',
  [SK.fieldcraft]: 'sk_fieldcraft', [SK.stratagem]: 'sk_stratagem', [SK.guile]: 'sk_guile',
};
/** a skill's icon, small, before its name on the Character page; a skill not listed yet shows none */
export const skillIcon = (skillId: string): HTMLElement | null => (SKILL_ICON[skillId] ? itemIcon(SKILL_ICON[skillId], undefined, 'skico') : null);
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
