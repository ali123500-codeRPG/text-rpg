// D-141 VW14/VW15 and ITI-220: drawing rewards from the library's reward tables (RW ids). A kept vow draws from RW1, the
// Weaver's scenario rewards from RW6; both fill a Boon budget the same way. A row shows only in the draws its showsIn names.
import type { GameState, Rng } from '../types';
import type { RewardSource } from '../types/library';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { RW } from '../library/tableIds';
import { boon } from '../scenario/boon';
import { threadboundInWorld } from '../ruleset/threadboundItems';

/** VW14: one pick from a reward table by weight, among the rows that show in this draw; a row naming another table
 * rolls that one (a reward type) */
export function drawReward(table: string, rng: Rng, from: RewardSource, depth = 0): { item: string; qty: number } | undefined {
  const rows = (getLibrary().rewardTables?.[table]?.rows ?? []).filter((r) => r.weight > 0 && (!r.showsIn || r.showsIn.includes(from)));
  const sum = rows.reduce((n, r) => n + r.weight, 0);
  if (!sum || depth > 8) return undefined;
  let at = rng.next() * sum;
  const row = rows.find((r) => (at -= r.weight) < 0) ?? rows[rows.length - 1];
  return row.table ? drawReward(row.table, rng, from, depth + 1) : row.item ? { item: row.item, qty: Math.max(1, row.qty ?? 1) } : undefined;
}

/** VW15: draws from `table` until the items' Boon reaches `budget`. A draw may pass the budget by up to
 * VOW_REWARD_MARGIN; one that would pass more is put back, and drawing stops if the total is already within the margin
 * below. At most VOW_REWARD_DRAWS_MAX draws. `merge` adds a repeat draw to the first one's qty. The Weaver's draw keeps the same practice (ITI-220). */
export function drawRewards(state: GameState, table: string, from: RewardSource, budget: number, rng: Rng, merge = true): { item: string; qty: number }[] {
  const m = CONFIG.VOW_REWARD_MARGIN;
  const out: { item: string; qty: number }[] = [];
  const taken = threadboundInWorld(state);
  let total = 0;
  for (let n = 0; n < CONFIG.VOW_REWARD_DRAWS_MAX && total < budget; n++) {
    const r = drawReward(table, rng, from);
    if (!r) break;
    const b = boon(state, r.item, r.qty);
    if (!(b > 0)) continue; // an item with no worth set can't be measured against the band: put back
    if (getLibrary().items[r.item]?.threadbound && (taken.includes(r.item) || out.some((x) => x.item === r.item))) continue; // one of a kind (D-218)
    if (total + b > budget * (1 + m)) { if (total >= budget * (1 - m)) break; continue; } // close enough, or put it back and draw again
    total += b;
    const had = merge ? out.find((x) => x.item === r.item) : undefined; // unmerged: each draw its own entry
    if (had) had.qty += r.qty; else out.push({ ...r });
  }
  return out;
}

/** ITI-220: a scenario's rewards for its gain grade, drawn from the Weaver's table (RW6) as a kept vow's are. Not yet
 * handed to the Weaver: how the draw reaches its plan is open (ITI-220). */
export function weaverRewards(state: GameState, gain: string, rng: Rng): { item: string; qty: number }[] {
  return drawRewards(state, RW.weaver, 'weaver', CONFIG.BOON_BUDGET[gain] ?? 0, rng);
}
