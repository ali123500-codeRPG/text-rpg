// The XP curve on its own (config only), so the engine and the Equations tab read one formula.
import { CONFIG } from '../config';

/** the XP curve: what the step from level n to n + 1 costs. xpToNext and xpToReach both ask it, so changing it changes both. */
export const levelCost = (n: number) => CONFIG.LEVEL_XP * Math.max(1, n);
/** the XP the curve asks to reach level L from 0: the sum of every step on the way */
export const xpToReach = (l: number) => { let n = 0; for (let i = 0; i < l; i++) n += levelCost(i); return n; };
