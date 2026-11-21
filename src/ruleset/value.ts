// SL12 b: an item's value is the coin its benefit numbers are worth, summed. Every benefit an item gives is read
// from the item itself (kit bonus, stated skill and roll bonuses, reach, armor, pools), so an item whose benefits
// don't come from its need is priced right too. Quality multiplies on top (SL8).
import type { AttackMode, GameState, ItemDef, ItemInstance } from '../types';
import { qualityMult } from './quality';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { effectValue, modeReach } from './gear';
import { requirement } from './requirements';
import { damageGrowth } from '../library/gearScale';
import { actionRow, actionSeconds, attackRowIds } from './actionTime';

const V = () => CONFIG.ITEM_VALUE;

/** IR4: a mode's damage per second: the class's damage (+ the mode's damageAdj), grown with the item's need (CE11), over
 * the seconds its attack rows take. */
export function modeDps(def: ItemDef, m: AttackMode): number {
  const dmg = ((CONFIG.WEAPON_CLASSES[m.class]?.damage ?? 0) + (m.damageAdj ?? 0)) * damageGrowth(requirement(def)?.need ?? 0);
  const secs = attackRowIds(def, m).reduce((n, id) => { const r = actionRow(id); return n + (r ? actionSeconds(r) : 0); }, 0);
  return dmg > 0 && secs > 0 ? dmg / secs : 0;
}

/** each benefit an item gives and the coin it is worth (positive benefits only; a penalty never lowers value) */
export function benefits(def: ItemDef): { what: string; coin: number }[] {
  const out: { what: string; coin: number }[] = [];
  for (const e of def.effects ?? []) {
    const v = effectValue(def, e);
    if (v <= 0) continue;
    // a roll bonus is worth the skill points that move a roll as much (skill counts at SKILL_WEIGHT)
    out.push(e.kind === 'rollMod'
      ? { what: `+${v} to ${e.roll} rolls`, coin: (v / CONFIG.SKILL_WEIGHT) * V().skillPoint }
      : { what: `+${v} ${e.kit ? 'kit bonus' : 'skill bonus'}`, coin: v * V().skillPoint });
  }
  const modes = def.weapon?.modes ?? [];
  // IR4: damage as damage per second: the class's damage (+ the mode's damageAdj) over the seconds its attack takes, best
  // mode; a thrown mode counts only its reach (PQ6 a)
  const dps = Math.max(0, ...modes.filter((m) => !m.thrown).map((m) => modeDps(def, m)));
  if (dps > 0) out.push({ what: `${+dps.toFixed(2)} damage a second`, coin: dps * V().dps });
  // reach in metres (ZR7), best mode; a throw counts at its own range; a ranged weapon's at its own lower rate (IR4)
  const reach = Math.max(0, ...modes.map((m) => modeReach(m) * (m.tree === 'ranged' && !m.thrown ? V().reachRangedM : V().reachM)));
  const far = Math.max(0, ...modes.map((m) => modeReach(m)));
  if (reach > 0) out.push({ what: `reach ${far} m`, coin: reach });
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
 * weapons are worth 0. Consumables and items with no benefit numbers (a curio, coin) keep their
 * hand-set value. Any other piece is worth its summed benefits, at least 1. */
export function itemValue(state: GameState | null | undefined, def: ItemDef): number {
  if (def.base) return itemValue(state, itemDef(state, def.base.itemId)) * CONFIG.QUALITY_PRICE_FACTOR * qualityMult(def.base.quality);
  if (def.tags?.includes('improvised')) return 0;
  if (!priced(def)) return def.value ?? 0;
  return Math.max(1, Math.round(benefits(def).reduce((n, b) => n + b.coin, 0)));
}

/** D-89: an item's pools and their points: a shield's, or an armor piece's per covered part */
export const poolsOf = (def: ItemDef): [string, number][] => (def.shield ? [['shield', def.shield.pool]] : Object.entries(def.armor?.pools ?? {}));
/** D-89: pool points an instance has lost, over all its pools (a pool below 0% has lost more than its size) */
export const missingPts = (def: ItemDef, inst: ItemInstance): number =>
  poolsOf(def).reduce((n, [k, pts]) => n + (Math.max(0, 100 - (inst.pools?.[k] ?? 100)) / 100) * pts, 0);

/** RP10 a: what one instance is worth: its value less the coin of the pool points it has lost (ITEM_VALUE.poolPoint), not below 0 */
export const instanceValue = (state: GameState | null | undefined, inst: ItemInstance): number => {
  const def = itemDef(state, inst.itemId);
  return Math.max(0, itemValue(state, def) - missingPts(def, inst) * V().poolPoint);
};
