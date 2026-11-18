// Gear stats that scale with an item's need (QE4/QE5, D-368): the one place each equation lives. The library's
// standard kit, minted gear (scenario/apply.ts mint) and the combat rating's relics (GR40) all read these.
import type { ArmorWeightKey } from '../scales';
import { CONFIG } from '../config';

/** QE4, D-368: the damage armor stops: ARMOR_FACTOR × need × ARMOR_WEIGHT_SOAK[weight] */
export const armorStop = (w: ArmorWeightKey, need: number): number => CONFIG.ARMOR_FACTOR * need * (CONFIG.ARMOR_WEIGHT_SOAK[w] ?? 1);
/** a need-0 (Crude) piece stops nothing: its multiplier is 1; otherwise its weight's */
export const armorMultiplier = (w: ArmorWeightKey, need: number): number => (need ? CONFIG.ARMOR_MULTIPLIER[w] : 1);
/** QE5: a shield's pool: POOL_BASE + POOL_FACTOR × need */
export const shieldPool = (need: number): number => CONFIG.POOL_BASE + CONFIG.POOL_FACTOR * need;
