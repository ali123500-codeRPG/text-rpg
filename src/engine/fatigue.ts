// Paying and recovering stamina (FT1–FT28). Every action pays its effort tier's strain (no roll): the short line drains
// first, and what an empty line can't hold spills into the long term at SPILL_SHARE; STRAIN_RESIDUE of every point stays there
// too (SR4), and travel pays by the hour straight into it (SR5). Hours awake add sleep debt; only sleep
// clears the long term. All stamina recovery goes through recoverLine and recoverDebt, one per layer, from the library
// recovery table (RV), as healing and composure go through applyHealing and calm.
import type { Actor, DurationDef, GameState } from '../types';
import { CONFIG } from '../config';
import { actorBody, getLibrary } from '../library';
import { FU, RV } from '../library/tableIds';
import { EFFORT, type EffortKey } from '../scales';
import { now } from '../time';
import { barMax, fatigueOf, isSpent, lineMax, lineUsed, perkSleepMult, staminaSkill, wornWeight } from '../ruleset/fatigue';
import { hasPerk } from '../ruleset/perks';
import { PK } from '../library/perkIds';
import { usableThisEngagement, useThisEngagement } from './engagement';
import { markStamina } from '../ruleset';
import { allActors, isActive, isAsleep, zoneById } from './relations';
import { logCode } from './effects';
import { fallAsleep, mayDropOff, planNight } from './sleep';

const fat = (a: Actor) => (a.core.condition.fatigue ??= { debt: 0, line: 0 });
const row = (id: string) => getLibrary().recovery?.[id];
const harder = (e: EffortKey, than: EffortKey) => EFFORT.pos(e) > EFFORT.pos(than);

/** adds points to the long-term bar; filling it leaves the actor Spent (FT10) */
function addDebt(state: GameState, a: Actor, points: number): void {
  const f = fat(a), was = isSpent(a);
  f.debt = Math.min(barMax(a), f.debt + points);
  f.line = Math.min(f.line, lineMax(a));
  if (!was && isSpent(a)) logCode(state, 'spent', { actorId: a.id });
}
/** FT27/FB6: every strain point the player pays counts toward a Stamina mark */
function countMarks(state: GameState, a: Actor, cost: number): void {
  if (a !== state.player) return;
  const f = fat(a);
  f.toMark = (f.toMark ?? 0) + cost;
  for (; f.toMark >= CONFIG.STAMINA_MARK_EVERY; f.toMark -= CONFIG.STAMINA_MARK_EVERY) markStamina(state, a);
}

/** FT24: pays `units` of an effort tier's strain (worn armour no longer multiplies it: TP6 d retired FT5). Above Light it resets catching your breath. The short
 * line drains first; what it can't hold spills at SPILL_SHARE, and STRAIN_RESIDUE of every point also stays in the long term
 * (SR4). Every point paid counts toward the player's Stamina marks (FT27, FB6). */
export function payStrain(state: GameState, a: Actor, effort: EffortKey, units = 1): void {
  const cost = CONFIG.STRAIN_COST[effort] * units * (hasPerk(a, PK.bottomless) ? CONFIG.BOTTOMLESS_STRAIN : 1);
  if (cost <= 0 || !isActive(a)) return;
  const f = fat(a);
  if (harder(effort, 'light')) f.hardAt = now(state);
  let used = lineUsed(a), left = lineMax(a) - used, pay = cost;
  if (cost > left && secondBreath(a)) { // SS8: the line empties, refills to SECOND_BREATH_PCT at once, and nothing spills this time
    const rest = cost - left;
    f.line = lineMax(a); recoverLine(a, RV.perk, CONFIG.SECOND_BREATH_PCT);
    used = lineUsed(a); left = lineMax(a) - used; pay = Math.min(rest, left);
    logCode(state, 'second_breath', { actorId: a.id });
  }
  f.line = used + Math.min(pay, left);
  addDebt(state, a, Math.max(0, pay - left) * CONFIG.SPILL_SHARE + cost * CONFIG.STRAIN_RESIDUE);
  countMarks(state, a, cost);
}
/** SR5: `minutes` of travel add TRAVEL_STRAIN_PER_HOUR a hour straight to the long-term bar, whatever the armour */
export function payTravel(state: GameState, a: Actor, minutes: number): void {
  const cost = CONFIG.TRAVEL_STRAIN_PER_HOUR * (minutes / 60);
  if (cost <= 0 || !isActive(a)) return;
  addDebt(state, a, cost);
  countMarks(state, a, cost);
}
/** SS8 Second Breath: once per engagement, only in one */
function secondBreath(a: Actor): boolean {
  if (!a.engagement || !hasPerk(a, PK.second_breath) || !usableThisEngagement(a, PK.second_breath)) return false;
  useThisEngagement(a, PK.second_breath);
  return true;
}
/** FT24: an Action times row's strain for `seconds` of it: once for a short row, per STRAIN_LONG_S it runs for a longer one */
export const payRow = (state: GameState, a: Actor, r: DurationDef | undefined, seconds: number): void => {
  if (r) payStrain(state, a, r.effort, r.seconds > CONFIG.STRAIN_LONG_S ? seconds / CONFIG.STRAIN_LONG_S : 1);
};
/** FT24: movement pays per STRAIN_MOVE_S moved: a walk (move time) or a run (a dash, main time) */
export const payMove = (state: GameState, a: Actor, paid: 'move' | 'main', seconds: number): void =>
  payStrain(state, a, paid === 'main' ? CONFIG.RUN_EFFORT : CONFIG.WALK_EFFORT, seconds / CONFIG.STRAIN_MOVE_S);
/** FT10: a Spent actor can't make an effort above Light */
export const tooSpent = (a: Actor, effort: EffortKey | undefined): boolean => isSpent(a) && harder(effort ?? 'base', 'light');

/** refills `pct` % of the short line from recovery row `sourceId`; every line refill goes through here. Returns the points */
export function recoverLine(a: Actor, sourceId: string, pct: number): number {
  const r = row(sourceId), used = lineUsed(a);
  if (!r || pct <= 0 || used <= 0) return 0; // a count-only row (Perks) is applied with the perk's own pct
  const got = Math.min(used, (pct / 100) * lineMax(a));
  fat(a).line = used - got;
  return got;
}
/** clears `pct` % of the bar from the long term, from recovery row `sourceId`; every long-term clear goes through here,
 * and the hours-awake count (FB4) falls by as much */
export function recoverDebt(a: Actor, sourceId: string, pct: number): number {
  const r = row(sourceId), f = fatigueOf(a);
  if (!r || pct <= 0 || f.debt <= 0) return 0;
  const got = Math.min(f.debt, (pct / 100) * barMax(a));
  const w = fat(a);
  w.debt = f.debt - got;
  if (w.awake) w.awake = Math.max(0, w.awake - got);
  return got;
}
/** FT8: sleep's speed here: in a bed or elsewhere, × the worn armour's weight, × the owner's sleepClear perks (SS14) */
export const sleepMult = (state: GameState, a: Actor): number =>
  CONFIG.SLEEP_SPOT_MULT[zoneById(state, a.zone)?.furniture?.some((f) => f.kind === FU.bed) ? 'bed' : 'elsewhere'] * (CONFIG.SLEEP_ARMOR_MULT[wornWeight(state, a) ?? ''] ?? 1) * perkSleepMult(a, 'sleepClear');

/** FT7: a rest that ran `share` of its hour refills the line; with Catnap (SS1) it also clears the sleep debt CATNAP_SLEEP_HOURS
 * of sleep would here. Both rest paths call this */
export function restRecover(state: GameState, a: Actor, share: number): void {
  recoverLine(a, RV.rest, (row(RV.rest)?.linePct ?? 0) * share);
  if (!hasPerk(a, PK.catnap)) return;
  recoverDebt(a, RV.perk, (row(RV.sleep)?.debtPctPerHour ?? 0) * CONFIG.CATNAP_SLEEP_HOURS * share * sleepMult(state, a));
}
/** FT9: minutes of sleep that clear the long term here, within SLEEP_MIN_HOURS to SLEEP_MAX_HOURS */
export function sleepMinutes(state: GameState, a: Actor): number {
  const perHour = ((row(RV.sleep)?.debtPctPerHour ?? 0) / 100) * barMax(a) * sleepMult(state, a);
  const h = perHour > 0 ? fatigueOf(a).debt / perHour : CONFIG.SLEEP_MAX_HOURS;
  return Math.ceil(Math.min(CONFIG.SLEEP_MAX_HOURS, Math.max(CONFIG.SLEEP_MIN_HOURS, h)) * 60);
}

/** FT4/FT7/FT28: `minutes` of game time just ran (the clock already moved on). Every actor, on stage or not: asleep it
 * sleeps (the long term clears, the line fills); awake it gains sleep debt, and catches its breath for the part of the
 * time BREATH_CALM_S after its last effort above Light. Sleep debt that fills the bar puts it to sleep (FT10), and so do
 * hours awake that alone would have filled it, Spent or not (FB4). */
export function passiveFatigue(state: GameState, minutes: number): void {
  if (minutes <= 0) return;
  const t1 = now(state);
  for (const a of allActors(state)) {
    if (!isActive(a)) continue;
    if (isAsleep(a)) {
      const s = row(RV.sleep);
      recoverDebt(a, RV.sleep, (s?.debtPctPerHour ?? 0) * (minutes / 60) * sleepMult(state, a));
      recoverLine(a, RV.sleep, s?.linePct ?? 0);
      continue;
    }
    const f = fat(a), max = barMax(a);
    const add = (CONFIG.SLEEP_DEBT_FLAT + (CONFIG.SLEEP_DEBT_PCT / 100) * max) * (actorBody(state, a).sleepNeed ?? 1) * perkSleepMult(a, 'sleepNeed') * (minutes / 60);
    if (add > 0) {
      const was = f.debt;
      f.debt = Math.min(max, f.debt + add);
      f.awake = (f.awake ?? 0) + add;
      // FB4 b: a Spent actor still collapses once its hours awake alone would have filled the bar. BF69: not while the guards
      // on falling asleep hold (just woken, alarmed, engaged, held): once they lift, the next minute takes it
      if (((was < max && f.debt >= max) || f.awake >= max) && mayDropOff(state, a)) collapse(state, a);
    }
    const calm = t1 - Math.max(t1 - minutes, (f.hardAt ?? -Infinity) + CONFIG.BREATH_CALM_S / 60);
    const b = row(RV.breath)?.perMinute;
    if (calm > 0 && b) recoverLine(a, RV.breath, (b.pct + staminaSkill(a) * b.perPoint) * calm);
  }
}

/** FT10: sleep debt filled the bar: the actor falls asleep where it stands, until rested (normal waking rules). The player's
 * sleep is a night of its own, so the clock runs it */
function collapse(state: GameState, a: Actor): void {
  logCode(state, 'collapsed', { actorId: a.id });
  const until = now(state) + sleepMinutes(state, a);
  if (a === state.player && !state.night) state.night = planNight(state, until - now(state), []);
  fallAsleep(state, a, a === state.player && state.night ? state.night.end : until);
}
