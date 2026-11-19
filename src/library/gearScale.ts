// Gear stats that scale with an item's need (QE4/QE5, D-368): the one place each equation lives. The library's
// standard kit, minted gear (scenario/apply.ts mint) and the combat rating's relics (GR40) all read these.
import type { ArmorWeightKey } from '../scales';
import { CONFIG } from '../config';

/** QE4, D-368: the damage armor stops: ARMOR_FACTOR × need × ARMOR_WEIGHT_SOAK[weight] */
export const armorStop = (w: ArmorWeightKey, need: number): number => CONFIG.ARMOR_FACTOR * need * (CONFIG.ARMOR_WEIGHT_SOAK[w] ?? 1);
/** LG23 a: what a worn piece takes off Dodge and Parry: ARMOR_DEFENSE_COST[weight] × need (a Crude piece costs nothing) */
export const armorDefenseCost = (w: ArmorWeightKey, need: number): number => (CONFIG.ARMOR_DEFENSE_COST[w] ?? 0) * need;
/** a need-0 (Crude) piece stops nothing: its multiplier is 1; otherwise its weight's */
export const armorMultiplier = (w: ArmorWeightKey, need: number): number => (need ? CONFIG.ARMOR_MULTIPLIER[w] : 1);
/** CE11: what a weapon's damage is multiplied by at this need: 1 + DAMAGE_NEED_RATE × need (a need-0 weapon keeps its class damage) */
export const damageGrowth = (need: number): number => 1 + CONFIG.DAMAGE_NEED_RATE * need;
/** QE5: a shield's pool: POOL_BASE + POOL_FACTOR × need */
export const shieldPool = (need: number): number => CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * need;
