// SY1: steadying yourself in a fight. A main action, in a fight only, never while Broken, and not again within
// STEADY_COOLDOWN_S of game time. One morale roll (Resolve), with Shaken against it; its tier wins back (or loses) a share of
// max morale (CONFIG.STEADY_PCT, more past either end): a gain is the Steadying yourself composure row, a loss the
// Trying to steady yourself makes it worse fear. Great Success or better also leaves the actor Mentally steady: its next
// morale loss is halved (payFear), then the buff is gone.
import type { Actor, GameState, Mod, Rng, RollResult } from '../types';
import { CONFIG } from '../config';
import { CP, FR } from '../library/tableIds';
import { moraleRoll, tierLevel } from '../ruleset';
import { maxMorale, moraleLevel } from '../ruleset/morale';
import { TIERS } from '../scales';
import { secondsSince } from '../time';
import { calm } from './heal';
import { payFear } from './morale';
import { isEngaged } from './relations';

export type Steadied = { roll: RollResult; pct: number; points: number; buff: boolean; broke?: 'broken' | 'surrendered' };

/** why `a` can't steady itself now, or null */
export function cantSteady(state: GameState, a: Actor): 'not_in_fight' | 'broken' | 'too_soon' | null {
  if (!isEngaged(state, a)) return 'not_in_fight';
  if (moraleLevel(a) === 'broken' || a.mind?.moraleState) return 'broken';
  if (a.core.condition.steadiedTurn !== undefined && secondsSince(state, a.core.condition.steadiedTurn) < CONFIG.STEADY_COOLDOWN_S) return 'too_soon';
  return null;
}

/** SY1: Shaken weighs on it: the worst Shaken the actor carries against anyone */
const shakenMods = (a: Actor): Mod[] => {
  const worst = Math.max(0, ...Object.values(a.pressure ?? {}).map((p) => p.shaken ?? 0));
  return worst ? [{ source: 'Shaken', type: 'status', value: -worst }] : [];
};

/** the share of max morale a steady roll of this tier level wins back (+) or loses (−) */
export function steadyPct(level: number): number {
  const top = TIERS.pos('critical_success'), bottom = TIERS.pos('critical_failure');
  if (level > top) return CONFIG.STEADY_PCT.critical_success + (level - top) * CONFIG.STEADY_PAST_PCT;
  if (level < bottom) return CONFIG.STEADY_PCT.critical_failure - (bottom - level) * CONFIG.STEADY_PAST_PCT;
  return CONFIG.STEADY_PCT[TIERS.at(level)] ?? 0;
}

/** one try. `pay` takes a morale loss (resolve.ts passes its fear(), which also applies a break); by default payFear */
export function steady(state: GameState, a: Actor, rng: Rng, pay: (cost: number) => Steadied['broke'] | void = (cost) => payFear(state, rng, a, FR.steady_slipped, { cost })): Steadied {
  a.core.condition.steadiedTurn = state.turn;
  const roll = moraleRoll(state, a, rng, 0, shakenMods(a));
  const level = tierLevel(roll), pct = steadyPct(level);
  let points = 0, broke: Steadied['broke'];
  if (pct > 0) points = calm(state, a, CP.steady, { pct });
  else if (pct < 0) {
    const before = a.core.condition.moraleLost ?? 0;
    broke = pay((-pct / 100) * maxMorale(a)) || undefined;
    points = before - (a.core.condition.moraleLost ?? 0);
  }
  const buff = level >= TIERS.pos('great_success');
  if (buff) a.core.condition.mentallySteady = true;
  return { roll, pct, points, buff, ...(broke ? { broke } : {}) };
}
