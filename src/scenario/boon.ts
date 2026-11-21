// Loot V8: a reward's worth (Boon) and a plan's Boon budget.
import type { GameState, StagePlan, Tier } from '../types';

type Reward = StagePlan['rewards'][number];
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { itemValue } from '../ruleset/value';

/** Loot V8: a reward's Boon = the item's boon (or its value ÷ BOON_COIN, src/ruleset/value.ts) × qty, × BOON_QUALITY for a minted item. */
export function boon(state: GameState, item: Reward['item'], qty = 1): number {
  const def = itemDef(state, typeof item === 'string' ? item : item.base);
  const q = typeof item === 'string' ? 'plain' : item.quality;
  return (def.boon ?? itemValue(state, def) / CONFIG.BOON_COIN) * qty * CONFIG.BOON_QUALITY[q];
}

/** steps the running scenario's event roll went past Critical Success (0 for any other tier) */
export const stepsPastCritical = (state: GameState, tier: Tier): number =>
  tier === 'critical_success' && tier === state.stage.tier ? Math.max(0, state.stage.tierBeyond ?? 0) : 0;

/** D-216c a: a plan's Boon budget for its gain, × BOON_PAST_CRIT_MULT per step past Critical Success */
export const boonBudget = (state: GameState, gain: string, tier: Tier): number =>
  (CONFIG.BOON_BUDGET[gain] ?? 0) * CONFIG.BOON_PAST_CRIT_MULT ** stepsPastCritical(state, tier);
