// RN1 (runaway-stacking page): the one stacking rule. n equal items total n^p, so the k-th largest counts k^p − (k−1)^p:
// p 1 adds in full, a smaller p grows more slowly, with no ceiling. Each scenario has its own exponent in config
// (MOD_STACK_EXP for roll modifiers within a type, PAYOFF_EXP for payoff pieces). A leaf module: never import './index'.
import { CONFIG } from '../config';

/** the weight of the k-th largest item (k from 1) at exponent p */
export const stackWeight = (k: number, p: number): number => k ** p - (k - 1) ** p;

/** values of one sign stacked at exponent p: the largest in full, the k-th at stackWeight(k, p) */
export function powerStack(values: number[], p: number): number {
  return [...values].sort((a, b) => Math.abs(b) - Math.abs(a)).reduce((s, v, i) => s + v * stackWeight(i + 1, p), 0);
}

/** CN4, RN4 a: a payoff perk's share for this many pieces: PAYOFF_SHARE each, stacked at PAYOFF_EXP, so
 * PAYOFF_SHARE × pieces^PAYOFF_EXP (5%, 8.7%, 12% …, no ceiling) */
export const payoffShare = (pieces: number): number => powerStack(Array<number>(pieces).fill(CONFIG.PAYOFF_SHARE), CONFIG.PAYOFF_EXP);
