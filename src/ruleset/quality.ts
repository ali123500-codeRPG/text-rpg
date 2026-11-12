// CS9: a minted item's quality is a key of QUALITY_LEVELS (src/scales.ts); the formulas read its multiplier from its position.
import { QUALITY_LEVELS, type QualityKey } from '../scales';

/** the quality multiplier: 1 for the lowest level, +1 per level up; 0 for no quality (not minted) */
export const qualityMult = (q: QualityKey | undefined): number => (q ? QUALITY_LEVELS.pos(q) + 1 : 0);
/** a quality the Weaver wrote: a key, a name, or the old number 1 to 4 */
export const qualityOf = (v: unknown): QualityKey | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= QUALITY_LEVELS.keys.length ? QUALITY_LEVELS.keys[v - 1] : QUALITY_LEVELS.keyOf(v);
