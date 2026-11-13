// Paying a fear (MB21–MB28): one rule for every source of the library fears table, the player included (MB11).
// A rolled fear's cost is scaled by the morale roll's tier (MB6); reaching Broken breaks the actor (MB1), or makes it
// surrender when the roll that broke it was a Critical Failure or worse (MB7). The caller applies what a break does.
import type { Actor, GameState, Rng } from '../types';
import { getLibrary } from '../library';
import { HEALTH_LEVELS, TIERS } from '../scales';
import { hasPerk, healthLevel, moraleRoll, tierLevel } from '../ruleset';
import { CONFIG } from '../config';
import { PK } from '../library/perkIds';
import { markResolve } from '../ruleset/improve';
import { maxMorale, moraleLevel, moraleLost, setMoraleLost, tierCostMult } from '../ruleset/morale';
import { isActive } from './relations';
import { logCode } from './effects';
import { tally } from './xp';

/** achievements count the player's morale lost, in flat points */
const creditLost = (state: GameState, a: Actor, paid: number) => { if (a === state.player && paid > 0) tally(state, 'morale_lost', { add: paid }); };


/** pays fear `id` (cost overrides the row's cost: a part fear's sum, partFearCost): gap = the contest's tier gap (perTier rows), mult and shift = a perk's extra (Make an Example, MB26),
 * overwhelm = the owner's Overwhelm took hold (MR4): all morale is lost and the actor surrenders.
 * Returns 'broken' or 'surrendered' when this pushed the actor to Broken. */
export function payFear(state: GameState, rng: Rng, a: Actor, id: string, o: { gap?: number; mult?: number; shift?: number; overwhelm?: boolean; cost?: number } = {}): 'broken' | 'surrendered' | undefined {
  const f = getLibrary().fears?.[id];
  if (!f || !isActive(a) || a.mind?.moraleState) return undefined;
  if (o.overwhelm) {
    const from = moraleLevel(a), paid = setMoraleLost(a, maxMorale(a));
    if (paid) markResolve(state, a, (100 * paid) / maxMorale(a));
    creditLost(state, a, paid);
    logCode(state, 'morale', { actorId: a.id, fear: id, paid, overwhelm: true, from, to: moraleLevel(a) });
    return from === 'broken' ? undefined : 'surrendered';
  }
  let cost = (o.cost ?? f.cost) * (f.perTier ? Math.abs(o.gap ?? 1) : 1) * (o.mult ?? 1);
  // All-50 Last to Fall: at Wounded or worse, morale losses shrink
  if (cost > 0 && hasPerk(a, PK.last_to_fall) && HEALTH_LEVELS.pos(healthLevel(a)) >= HEALTH_LEVELS.pos('wounded')) cost *= CONFIG.LAST_TO_FALL_MULT;
  let level: number | undefined;
  if (f.rolled && cost > 0) {
    const r = moraleRoll(state, a, rng, o.shift);
    level = tierLevel(r);
    cost *= tierCostMult(level);
  }
  // SY1: Mentally steady halves the next morale loss, then is gone
  if (cost > 0 && a.core.condition.mentallySteady) { cost *= CONFIG.STEADY_BUFF_MULT; delete a.core.condition.mentallySteady; }
  const from = moraleLevel(a);
  const paid = setMoraleLost(a, moraleLost(a) + cost);
  if (!paid) return undefined;
  const to = moraleLevel(a);
  markResolve(state, a, (100 * paid) / maxMorale(a));
  creditLost(state, a, paid);
  logCode(state, 'morale', { actorId: a.id, fear: id, paid, ...(level === undefined ? {} : { tier: level }), from, to });
  if (to !== 'broken' || from === 'broken') return undefined;
  return level !== undefined && level <= TIERS.pos('critical_failure') ? 'surrendered' : 'broken';
}
