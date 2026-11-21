// Healing ("Healing: options" H1–H15). Every source is a row of the library healing table, applied by
// this one rule, so amounts stay consistent (B5) and new sources or tiers are new rows (H1).
import { CP, HL } from '../library/tableIds';
import type { Actor, GameState } from '../types';
import { PART_STATES, type PartStateKey } from '../scales';
import { CONFIG } from '../config';
import { actorBody, getLibrary } from '../library';
import { recoveryMult, healthLevel, partStates, totalHp, trueSkill } from '../ruleset';
import { partPct, poolState } from '../ruleset/body';
import { isActive } from './relations';
import { logCode } from './effects';
import { achievementSum } from '../ruleset/achRewards';
import { moraleLost, restoreMorale, setMoraleLost } from '../ruleset/morale';
import { tally } from './xp';
import { now } from '../time';

/** H5, T7: the clock that holds when an actor last rested */
export const restClock = (id: string) => `rest:${id}`;

/** game minutes since `a` last rested (Infinity: never); Rest waits until this reaches CONFIG.REST_COOLDOWN_MIN */
export function minutesSinceRest(state: GameState, a: Actor): number {
  const last = state.clocks[restClock(a.id)];
  return last === undefined ? Infinity : now(state) - last;
}

export const healingName = (id: string) => getLibrary().healing?.[id]?.name ?? id;

/** A perk heals the owner straight: health lost drops to `toLostPct` (never raises it). Every perk that heals directly
 * goes through here, so its healing counts under the Perks row (HL.perk) with no extra code; the unit test
 * hp-writes.test.ts fails if code lowers health lost anywhere else. Returns the health % healed. */
export function healFromPerk(state: GameState, a: Actor, toLostPct: number): number {
  const c = a.core.condition, got = Math.max(0, c.hpLostPct - toLostPct);
  c.hpLostPct -= got;
  creditHealing(state, a, HL.perk, got);
  return got;
}

/** Achievements count the HP the player gets back (a flat number: the health % healed of their total HP), by where it
 * came from: the healing row's id. Only a perk that heals directly (Second Wind) counts under the Perks row (HL.perk);
 * a perk that boosts another source (Fast Healer) counts as that source. Health only, not body parts. */
export function creditHealing(state: GameState, a: Actor, sourceId: string, pct: number): void {
  if (a === state.player && pct > 0) tally(state, 'healed', { by: 'heal_source', of: sourceId, add: pct / 100 * totalHp(state, a) });
}

/** Restores morale from a composure-table row (the morale twin of applyHealing): the row's pct of max morale (or its flat
 * `points`, × `times` when given, e.g. per tier of a rally roll), or `pct` for hourly rows. Every morale restore goes through here, so achievements count it by source (morale-writes.test.ts enforces).
 * Returns the morale points restored. */
export function calm(state: GameState, a: Actor, sourceId: string, opts: { pct?: number; times?: number } = {}): number {
  const src = getLibrary().composure?.[sourceId];
  if (!src || src.countOnly) return 0;
  const got = src.points !== undefined && opts.pct === undefined ? -setMoraleLost(a, moraleLost(a) - src.points * (opts.times ?? 1)) : -restoreMorale(a, opts.pct ?? src.pct);
  creditCalm(state, a, sourceId, got);
  return got;
}

/** A perk restores the owner's morale straight: `pct` % of max morale. Every perk that restores morale directly goes
 * through here, so it counts under the Perks row (CP.perk). Returns the morale points restored. */
export function calmFromPerk(state: GameState, a: Actor, pct: number): number {
  const got = -restoreMorale(a, pct);
  creditCalm(state, a, CP.perk, got);
  return got;
}

/** Achievements count the morale points the player gets back (a flat number), by the composure row it came from */
function creditCalm(state: GameState, a: Actor, sourceId: string, points: number): void {
  if (a === state.player && points > 0) tally(state, 'calmed', { by: 'morale_source', of: sourceId, add: points });
}

/** does the composure row restore anything now? */
const wouldCalm = (a: Actor, sourceId?: string): boolean => {
  const src = sourceId ? getLibrary().composure?.[sourceId] : undefined;
  return !!src && !src.countOnly && (src.pct > 0 || (src.points ?? 0) > 0) && moraleLost(a) > 0;
};

/** D-114 (HD1–HD5): how much of its wounds a row's heal mends, in % of total HP: the general area's share of health lost
 * (what the parts' hits do not explain) plus each part the row reaches, by what it adds to health lost (× its impact; a part
 * that costs no health counts as a normal part). A part worse than the row's reach is left out (H4). */
export function woundsPct(state: GameState, a: Actor, reach: PartStateKey): number {
  const parts = actorBody(state, a).parts, lost = (id: string) => Math.max(0, 100 - partPct(a, id));
  const inHealth = parts.reduce((t, p) => t + lost(p.id) * CONFIG.PART_SHARE[p.size] * CONFIG.IMPACT_MULT[p.impact], 0);
  const general = Math.max(0, a.core.condition.hpLostPct - inHealth);
  return general + parts.filter((p) => PART_STATES.pos(poolState(partPct(a, p.id))) <= PART_STATES.pos(reach))
    .reduce((t, p) => t + lost(p.id) * CONFIG.PART_SHARE[p.size] * (CONFIG.IMPACT_MULT[p.impact] || 1), 0);
}

/** Heals the row's flat % of total HP (`pct` replaces it, for hourly rows and Heal). Every wound the row reaches mends the
 * same share: heal ÷ woundsPct, at most 1, so each reached part gets back that share of what its pool is missing (a Crippled
 * part too, from where it is). Destroyed parts need a row that reaches them (OQ-6: a special perk, item or story event).
 * `quiet` logs only a visible change (passive healing). Returns false if nothing changed. */
export function applyHealing(state: GameState, a: Actor, sourceId: string, opts: { pct?: number; quiet?: boolean; share?: number } = {}): boolean {
  const src = getLibrary().healing?.[sourceId];
  if (!src) return false;
  const c = a.core.condition;
  const level = healthLevel(a);
  if (level === 'dead' && !src.revivesDead) return false; // no row heals the dead for now
  const before = partStates(state, a);
  const lost = c.hpLostPct;
  const extra = sourceId === HL.rest ? achievementSum(a, 'restPct') : 0; // an achievement reward: + % on each rest
  const share = opts.share ?? 1; // AT27: an action whose output is a share, broken off, heals by the share it ran
  const amount = (opts.pct ?? src.hpPct + extra) * share;
  const wounds = woundsPct(state, a, src.reach);
  const mend = wounds > 0 ? Math.min(1, amount / wounds) : 0;
  c.hpLostPct = Math.max(0, lost - amount);
  const reach = PART_STATES.pos(src.reach);
  const changed: { id: string; from: string; to: string }[] = [];
  let healed = false;
  for (const p of before) {
    if (!(p.id in c.parts) || PART_STATES.pos(p.state) > reach) continue;
    const pct = c.parts[p.id];
    c.parts[p.id] = pct + mend * (100 - pct);
    healed ||= c.parts[p.id] !== pct;
  }
  for (const p of partStates(state, a)) {
    const was = before.find((b) => b.id === p.id)!.state;
    if (was !== p.state) changed.push({ id: p.id, from: was, to: p.state });
  }
  creditHealing(state, a, sourceId, lost - c.hpLostPct);
  if (src.composure) healed = calm(state, a, src.composure, opts.share !== undefined ? { pct: (getLibrary().composure?.[src.composure]?.pct ?? 0) * share } : {}) > 0 || healed; // MB8: the action's morale comes from the composure table
  const to = healthLevel(a);
  if (!opts.quiet || to !== level || changed.length) logCode(state, 'healed', { actorId: a.id, source: sourceId, from: level, to, parts: changed, better: c.hpLostPct < lost || healed });
  return c.hpLostPct !== lost || healed;
}

/** Q3: would this source heal anything? A healing item isn't used up when it wouldn't. */
export function wouldHeal(state: GameState, a: Actor, sourceId: string): boolean {
  const src = getLibrary().healing?.[sourceId];
  if (!src) return false;
  const c = a.core.condition;
  if (healthLevel(a) === 'dead' && !src.revivesDead) return false;
  if (c.hpLostPct > 0 && src.hpPct > 0) return true;
  if (wouldCalm(a, src.composure)) return true;
  const reach = PART_STATES.pos(src.reach);
  return src.hpPct > 0 && partStates(state, a).some((p) => p.id in c.parts && c.parts[p.id] < 100
    && PART_STATES.pos(p.state) <= reach);
}

/** an hourly row's % for the minutes passed: the row's skill (true value) × its pctPerPoint, per hour */
const hourlyPct = (a: Actor, row: { skill: string; pctPerPoint: number }, minutes: number): number => trueSkill(a, row.skill) * row.pctPerPoint * (minutes / 60);

/** H12–H14: hourly rows (natural recovery, and natural composure from the composure table) heal every active actor on the
 * world for the game minutes that passed, fights included (WI8 a: no ground is off the stage). */
export function passiveHealing(state: GameState, minutes: number): void {
  if (minutes <= 0) return;
  const stage = new Set(state.zones.map((z) => z.id));
  const rows = Object.values(getLibrary().healing ?? {}).filter((h) => h.hourly);
  const calmRows = Object.values(getLibrary().composure ?? {}).filter((c) => c.hourly && !c.countOnly);
  for (const a of [state.player, ...state.actors]) {
    if (!isActive(a) || (a !== state.player && !stage.has(a.zone))) continue;
    for (const h of rows) {
      const pct = hourlyPct(a, h.hourly!, minutes) * recoveryMult(a); // Fast Healer
      if (pct > 0) applyHealing(state, a, h.id, { pct, quiet: true });
    }
    for (const c of calmRows) { // MB34
      const pct = hourlyPct(a, c.hourly!, minutes) * recoveryMult(a); // Fast Healer: morale's natural recovery too
      if (pct > 0) calm(state, a, c.id, { pct });
    }
  }
}
