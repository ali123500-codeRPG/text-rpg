// SL12 b: an item's value is the coin its benefit numbers are worth, summed. Every benefit an item gives is read
// from the item itself (kit bonus, stated skill and roll bonuses, reach, armor, pools), so an item whose benefits
// don't come from its need is priced right too. Quality multiplies on top (SL8).
import type { GameState, ItemDef } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from '../library';
import { kitBonus, modeReach } from './gear';
import { reachLinks } from './range';

const V = () => CONFIG.ITEM_VALUE;

/** each benefit an item gives and the coin it is worth (positive benefits only; a penalty never lowers value) */
export function benefits(def: ItemDef): { what: string; coin: number }[] {
  const out: { what: string; coin: number }[] = [];
  for (const e of def.effects ?? []) {
    const v = e.kit ? kitBonus(def, e) : e.value;
    if (v <= 0) continue;
    // a roll bonus is worth the skill points that move a roll as much (skill counts at SKILL_WEIGHT)
    out.push(e.kind === 'rollMod'
      ? { what: `+${v} to ${e.roll} rolls`, coin: (v / CONFIG.SKILL_WEIGHT) * V().skillPoint }
      : { what: `+${v} ${e.kit ? 'kit bonus' : 'skill bonus'}`, coin: v * V().skillPoint });
  }
  const reach = Math.max(0, ...(def.weapon?.modes ?? []).map((m) => reachLinks(modeReach(m)))); // whole zone links; a throw counts at its own range
  if (reach > 0) out.push({ what: `reach ${reach}`, coin: reach * V().reachZone });
  if (def.armor) {
    const parts = def.armor.covers.length;
    const perPart = def.armor.reduction * V().armorStop + (1 - def.armor.multiplier) * 100 * V().armorCut;
    if (perPart > 0) out.push({ what: `armor on ${parts} parts`, coin: perPart * parts });
    for (const [part, pool] of Object.entries(def.armor.pools ?? {})) out.push({ what: `${part} pool ${pool}`, coin: pool * V().poolPoint });
  }
  if (def.shield) out.push({ what: `shield pool ${def.shield.pool}`, coin: def.shield.pool * V().poolPoint });
  return out;
}

const priced = (def: ItemDef) => !def.consumable && (!!def.weapon || !!def.armor || !!def.shield || (def.effects ?? []).length > 0);

/** SL12–SL14: an item's value in coin. Minted: its base's value × QUALITY_PRICE_FACTOR × quality (SL8). Improvised
 * weapons are worth 0. Consumables and items with no benefit numbers (a signet ring, a curio, coin) keep their
 * hand-set value. Any other piece is worth its summed benefits, at least 1. */
export function itemValue(state: GameState | null | undefined, def: ItemDef): number {
  if (def.base) return itemValue(state, itemDef(state, def.base.itemId)) * CONFIG.QUALITY_PRICE_FACTOR * def.base.quality;
  if (def.tags?.includes('improvised')) return 0;
  if (!priced(def)) return def.value;
  return Math.max(1, Math.round(benefits(def).reduce((n, b) => n + b.coin, 0)));
}
