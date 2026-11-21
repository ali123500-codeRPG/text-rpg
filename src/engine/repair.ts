// D-89 repair (RP12–RP17): Handiwork mends an item's pools, at a forge or in the field, and a Smith sells it.
// E = effective Handiwork × FORGE_MULT at a usable forge (1 elsewhere); r = the item's need ÷ E. r ≤ 1 is a sure Success,
// past REPAIR_REACH nothing is tried, between them one roll: margin = d100 − REPAIR_RISK × (r − 1) on the usual bands.
// At a forge Success or better puts every pool back to full, Near Miss half of what is missing, Critical Failure drops it
// one band; in the field each tier puts back its REPAIR_FIELD_SHARE of the pool and never lifts a Broken item.
import type { Actor, Furniture, GameState, ItemDef, ItemInstance, Rng, Tier } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { FU } from '../library/tableIds';
import { SK } from '../library/skillIds';
import { SV } from '../library/serviceIds';
import { band, naturalEdge, ruleset, tierAt, tierAtLeast, tierLevel } from '../ruleset';
import { effectiveSkill } from '../ruleset/gear';
import { requirement } from '../ruleset/requirements';
import { itemState } from '../ruleset/body';
import { ITEM_STATES, TIERS, type ItemStateKey } from '../scales';
import { missingPts, poolsOf } from '../ruleset/value';
import { isActive } from './relations';
import { withinGrip } from './position';
import { priceFor } from './trade';

const pctOf = (inst: ItemInstance, k: string) => inst.pools?.[k] ?? 100;
const totalPts = (def: ItemDef) => poolsOf(def).reduce((n, [, p]) => n + p, 0);
/** the worst state among an item's pools */
export const repairState = (def: ItemDef, inst: ItemInstance): ItemStateKey =>
  itemState(Math.min(100, ...poolsOf(def).map(([k]) => pctOf(inst, k))));
/** share of its pools an item has lost (1 = empty; more when a pool is below 0%) */
export const missingShare = (def: ItemDef, inst: ItemInstance): number => (totalPts(def) ? missingPts(def, inst) / totalPts(def) : 0);

/** a forge within the actor's grip reach */
export const forgeAt = (state: GameState, a: Actor): Furniture | undefined => state.furniture.find((f) => f.kind === FU.forge && withinGrip(state, a, f));
/** RP8 b: a smith works only where its place has a forge */
export const placeHasForge = (state: GameState, placeId: string): boolean => state.furniture.some((f) => f.kind === FU.forge && f.placeId === placeId);
/** RP17 b: the smith who works at forge f: someone active in its place who sells repair */
export const smithAt = (state: GameState, f: Furniture): Actor | undefined =>
  state.actors.find((x) => x.placeId === f.placeId && isActive(x) && !!x.wares?.services.includes(SV.repair));
/** RP17 b: `a` may use forge f: no smith works there, `a` is the smith, or `a` hired it (SV.forge) */
export const mayUseForge = (state: GameState, a: Actor, f: Furniture): boolean => { const s = smithAt(state, f); return !s || s === a || f.booked?.by === a.id; };

/** RP13: r = the item's need ÷ (effective Handiwork × FORGE_MULT at a forge); a piece with no requirement is 0 */
export function repairRatio(state: GameState, a: Actor, def: ItemDef, forge: boolean): number {
  const need = requirement(def)?.need ?? 0;
  const e = effectiveSkill(state, a, SK.handiwork).value * (forge ? CONFIG.FORGE_MULT : 1);
  return need <= 0 ? 0 : e > 0 ? need / e : Infinity;
}
/** RP15 b: REPAIR_S × r^REPAIR_TIME_POWER × the share of the pools put back */
export const repairSeconds = (r: number, share: number): number => CONFIG.REPAIR_S * r ** CONFIG.REPAIR_TIME_POWER * share;
/** RP23: the share a try aims at: at a forge all that is missing; in the field the Success share, at most what is missing */
export const aimedShare = (def: ItemDef, inst: ItemInstance, forge: boolean): number =>
  forge ? missingShare(def, inst) : Math.min(missingShare(def, inst), CONFIG.REPAIR_FIELD_SHARE.success);

/** RP13 a: the tier of a repair at ratio r with d100 `d` (r ≤ 1 never rolls: a sure Success) */
export function repairTier(r: number, d: number): Tier {
  const top = TIERS.keys.length - 1;
  return tierAt(Math.max(0, Math.min(top, band(d - CONFIG.REPAIR_RISK * (r - 1)) + naturalEdge(d)))).tier;
}
/** a repair's tier: sure at r ≤ 1, else rolled; null past REPAIR_REACH */
export const rollRepair = (r: number, rng: Rng): { tier: Tier; rolled: boolean } | null =>
  r <= 1 ? { tier: 'success', rolled: false } : r > CONFIG.REPAIR_REACH ? null : { tier: repairTier(r, rng.d100()), rolled: true };

/** RP14 a: what a tier does to the item's pools, `share` of it (RP24: a job broken off counts the share of its time done);
 * returns false when it ends Destroyed (the caller drops it) */
export function applyRepair(def: ItemDef, inst: ItemInstance, tier: Tier, forge: boolean, share = 1): boolean {
  const pools = poolsOf(def);
  const set = (fn: (pct: number) => number) => {
    inst.pools = { ...inst.pools, ...Object.fromEntries(pools.map(([k]) => { const p = pctOf(inst, k); return [k, p + (fn(p) - p) * share]; })) };
  };
  const lv = tierLevel(tier);
  if (lv <= tierLevel('critical_failure')) {
    // one band down: to the floor of its state, the top of the next (armor pools stop at 0%: the rest reaches the body)
    set((pct) => Math.max(def.shield ? -Infinity : 0, CONFIG.ITEM_STATE_ABOVE[itemState(pct)] ?? pct));
    return repairState(def, inst) !== 'destroyed';
  }
  if (forge) {
    if (lv >= tierLevel('success')) set(() => 100);
    else if (tier === 'near_miss') set((pct) => pct + (100 - pct) * CONFIG.REPAIR_NEAR_MISS_SHARE);
  } else {
    const share = CONFIG.REPAIR_FIELD_SHARE[tier] ?? (lv > tierLevel('success') ? CONFIG.REPAIR_FIELD_SHARE.critical_success : 0);
    if (share > 0) set((pct) => Math.min(100, pct + share * 100));
  }
  return true;
}

/** a self repair (no smith) done, or `share` of it when broken off: rolled when in doubt (a roll marks Handiwork), applied,
 * and a hired forge's booking used up (RP22 a). Returns the tier and whether the item is still whole */
export function repairSelf(state: GameState, a: Actor, job: RepairJob, rng: Rng, share = 1): { tier: Tier; whole: boolean } {
  const t = rollRepair(job.r, rng)!; // repairJob refused anything past REPAIR_REACH
  if (t.rolled) ruleset.recordUse(a, SK.handiwork, { actorId: a.id, skill: SK.handiwork, target: requirement(job.def)?.need ?? 0, passed: tierAtLeast(t.tier, 'success'), modifiers: [] }, state);
  const whole = applyRepair(job.def, job.inst, t.tier, !!job.forge, share);
  if (job.forge?.booked?.by === a.id) delete job.forge.booked;
  if (!whole) a.core.inventory = a.core.inventory.filter((i) => i !== job.inst); // Destroyed: lost
  return { tier: t.tier, whole };
}

/** RP12: a Broken item needs a forge; the states a field repair can work on */
export const fieldCanMend = (def: ItemDef, inst: ItemInstance): boolean => ITEM_STATES.pos(repairState(def, inst)) < ITEM_STATES.pos('broken');

/** D-89: an item's def and instance when it has pools to mend */
export const mendable = (state: GameState, inst: ItemInstance | undefined): { def: ItemDef; inst: ItemInstance } | null => {
  if (!inst) return null;
  const def = itemDef(state, inst.itemId);
  return poolsOf(def).length ? { def, inst } : null;
};

/** RP6 a: a smith's price: the coin of the pool points put back (ITEM_VALUE.poolPoint), through the ware price equation */
export const repairPrice = (buyer: Actor, smith: Actor, def: ItemDef, inst: ItemInstance): number =>
  priceFor(buyer, smith, missingPts(def, inst) * CONFIG.ITEM_VALUE.poolPoint);

export type RepairJob = { def: ItemDef; inst: ItemInstance; smith?: Actor; forge?: Furniture; r: number; seconds: number };
/** a repair of item `item` by `a`, from smith `smith` when given, else by `a`'s own Handiwork at a forge it may use or in
 * the field; or why it can't be done (the order is wasted with that reason) */
export function repairJob(state: GameState, a: Actor, item: string | null | undefined, smith?: Actor): RepairJob | { why: string } {
  const m = mendable(state, a.core.inventory.find((i) => i.id === item || i.itemId === item));
  if (!m) return { why: item && a.core.inventory.some((i) => i.id === item || i.itemId === item) ? 'nothing_to_repair' : 'no_item' };
  const { def, inst } = m;
  if (missingPts(def, inst) <= 0) return { why: 'nothing_to_repair' };
  if (smith && smith !== a) {
    if (!isActive(smith) || !smith.wares?.services.includes(SV.repair)) return { why: 'not_offered' };
    if (!placeHasForge(state, smith.placeId)) return { why: 'no_forge' }; // RP8 b
    const r = repairRatio(state, smith, def, true);
    if (r > 1) return { why: 'beyond_smith' }; // RP16 a: a smith takes only sure jobs
    return { def, inst, smith, r, seconds: repairSeconds(r, aimedShare(def, inst, true)) };
  }
  const f = forgeAt(state, a), forge = f && mayUseForge(state, a, f) ? f : undefined;
  if (!forge && !fieldCanMend(def, inst)) return { why: 'needs_forge' }; // RP12: Broken takes a forge
  const r = repairRatio(state, a, def, !!forge);
  if (r > CONFIG.REPAIR_REACH) return { why: 'beyond' };
  return { def, inst, ...(forge ? { forge } : {}), r, seconds: repairSeconds(r, aimedShare(def, inst, !!forge)) };
}
