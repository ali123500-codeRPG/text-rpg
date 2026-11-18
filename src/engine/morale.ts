// Paying a fear (MB21–MB28): one rule for every source of the library fears table, the player included (MB11).
// A rolled fear's cost is scaled by the morale roll's tier (MB6); reaching Broken breaks the actor (MB1), or makes it
// surrender when the roll that broke it was a Critical Failure or worse (MB7). The caller applies what a break does.
import type { Actor, FearDef, GameState, Rng } from '../types';
import { getLibrary } from '../library';
import { HEALTH_LEVELS, INTELLIGENCE, TIERS } from '../scales';
import { hasPerk, healthLevel, moraleRoll, tierLevel } from '../ruleset';
import { CONFIG } from '../config';
import { PK } from '../library/perkIds';
import { markResolve } from '../ruleset/improve';
import { isBrokenLevel, maxMorale, moraleLevel, moraleLost, setMoraleLost, tierCostMult } from '../ruleset/morale';
import { isActive } from './relations';
import { logCode } from './effects';
import { tally } from './xp';

/** achievements count the player's morale lost, in flat points */
const creditLost = (state: GameState, a: Actor, paid: number) => { if (a === state.player && paid > 0) tally(state, 'morale_lost', { add: paid }); };

/** BG-268 (BF78): an Intelligent or Semi-intelligent race can give itself up (a beaten wolf shows its belly); an Unintelligent
 * one (a slime) never does: a break that would be a surrender just breaks. An actor with no race keeps the old rule. */
function breakAs(a: Actor, giveUp: boolean): 'broken' | 'surrendered' {
  const mind = a.core.raceId ? getLibrary().races?.[a.core.raceId]?.intelligence : undefined;
  return giveUp && (!mind || INTELLIGENCE.pos(mind) >= INTELLIGENCE.pos('semi')) ? 'surrendered' : 'broken';
}

/** a fear's cost before its morale roll's tier: its cost (or the given one) × the gap's tiers when it counts per tier × any
 * multiplier, shrunk by All-50 Last to Fall at Wounded or worse. payFear and the combat rating's fight model both read it. */
export function fearCost(a: Actor, f: FearDef, o: { gap?: number; mult?: number; cost?: number } = {}): number {
  const cost = (o.cost ?? f.cost) * (f.perTier ? Math.abs(o.gap ?? 1) : 1) * (o.mult ?? 1);
  return cost > 0 && hasPerk(a, PK.last_to_fall) && HEALTH_LEVELS.pos(healthLevel(a)) >= HEALTH_LEVELS.pos('wounded') ? cost * CONFIG.LAST_TO_FALL_MULT : cost; // All-50 Last to Fall
}
/** pays fear `id` (cost overrides the row's cost: a part fear's sum, partFearCost): gap = the contest's tier gap (perTier rows), mult and shift = a perk's extra (Make an Example, MB26),
 * overwhelm = the owner's Overwhelm took hold (MR4): all morale is lost and the actor surrenders (breaks, if it cannot: BG-268).
 * Returns 'broken' or 'surrendered' when this pushed the actor to Broken (or past it); a broken one paying more goes on
 * toward Cowering (BF79) and returns nothing. */
export function payFear(state: GameState, rng: Rng, a: Actor, id: string, o: { gap?: number; mult?: number; shift?: number; overwhelm?: boolean; cost?: number } = {}): 'broken' | 'surrendered' | undefined {
  const f = getLibrary().fears?.[id];
  // BF79: a broken one still pays, down to Cowering; one that surrendered pays no more
  if (!f || !isActive(a) || a.mind?.moraleState === 'surrendered') return undefined;
  if (o.overwhelm) {
    const from = moraleLevel(a), paid = setMoraleLost(a, Math.max(moraleLost(a), maxMorale(a)));
    if (paid) markResolve(state, a, (100 * paid) / maxMorale(a));
    creditLost(state, a, paid);
    logCode(state, 'morale', { actorId: a.id, fear: id, paid, overwhelm: true, from, to: moraleLevel(a) });
    return isBrokenLevel(from) ? undefined : breakAs(a, true);
  }
  let cost = fearCost(a, f, o);
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
  if (!isBrokenLevel(to) || isBrokenLevel(from)) return undefined;
  return breakAs(a, level !== undefined && level <= TIERS.pos('critical_failure'));
}
