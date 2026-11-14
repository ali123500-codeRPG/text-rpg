// The XP curve and the perk-point levels on their own (config only), so the engine, spawn and the Equations tab read one formula.
import { CONFIG } from '../config';

/** the XP curve: what the step from level n to n + 1 costs. xpToNext and xpToReach both ask it, so changing it changes both. */
export const levelCost = (n: number) => CONFIG.LEVEL_XP * Math.max(1, n);
/** the XP the curve asks to reach level L from 0: the sum of every step on the way */
export const xpToReach = (l: number) => { let n = 0; for (let i = 0; i < l; i++) n += levelCost(i); return n; };
/** Part 1 §5: a character level that gives a perk point (every PERK_POINT_EVERY levels: every even level) */
export const perkPointAt = (level: number): boolean => level > 0 && level % CONFIG.PERK_POINT_EVERY === 0;
/** the perk points a character has had by `level` (one per perkPointAt level passed) */
export const perkPointsUpTo = (level: number): number => Math.floor(Math.max(0, level) / CONFIG.PERK_POINT_EVERY);
