// Healing ("Healing: options" H1–H15). Every source is a row of the library healing table, applied by
// this one rule, so amounts stay consistent (B5) and new sources or tiers are new rows (H1).
import { HL } from '../library/tableIds';
import type { Actor, GameState } from '../types';
import { getLibrary } from '../library';
import { PART_STATES } from '../scales';
import { boostMult, healthLevel, partStates, trueSkill } from '../ruleset';
import { isActive } from './relations';
import { logCode } from './effects';
import { bestReward } from '../ruleset/achRewards';
import { moraleLost, restoreMorale } from '../ruleset/morale';
import { tally } from './xp';

export const healingName = (id: string) => getLibrary().healing?.[id]?.name ?? id;

/** Restores the row's share of HP and of each part pool (`pct` replaces both, for hourly rows). A part heals only if its state is no worse
 * than the row's reach (H4/H12); a Crippled or worse part a row reaches starts again from 0. Destroyed parts need a row
 * that reaches them (OQ-6: a special perk, item or story event). `quiet` logs only a visible change (passive healing).
 * Returns false if nothing changed. */
/** Achievements count the health % the player gets back, by where it came from: the healing row's id. Healing a perk
 * gives (Second Wind, Fast Healer's extra) is counted under the Perks row (HL.perk). Health only, not body parts. */
export function creditHealing(state: GameState, a: Actor, sourceId: string, pct: number): void {
  if (a === state.player && pct > 0) tally(state, 'healed', { by: 'heal_source', of: sourceId, add: pct });
}

/** `boost`: a perk multiplied this healing (Fast Healer); the part above ×1 is counted as healing from perks */
export function applyHealing(state: GameState, a: Actor, sourceId: string, opts: { pct?: number; quiet?: boolean; boost?: number } = {}): boolean {
  const src = getLibrary().healing?.[sourceId];
  if (!src) return false;
  const c = a.core.condition;
  const level = healthLevel(a);
  if (level === 'Dead' && !src.revivesDead) return false; // no row heals the dead for now
  const before = partStates(state, a);
  const lost = c.hpLostPct;
  const extra = sourceId === HL.rest ? bestReward(a, 'restPct')?.value ?? 0 : 0; // an achievement reward: + % on each rest
  c.hpLostPct = Math.max(0, lost - (opts.pct ?? src.hpPct + extra));
  const reach = PART_STATES.pos(src.reach);
  const changed: { id: string; from: string; to: string }[] = [];
  let healed = false;
  for (const p of before) {
    if (!(p.id in c.parts) || PART_STATES.pos(PART_STATES.keyOf(p.state)!) > reach) continue;
    const pct = c.parts[p.id];
    c.parts[p.id] = Math.min(100, Math.max(0, pct) + (opts.pct ?? src.partPct + extra));
    healed ||= c.parts[p.id] !== pct;
  }
  for (const p of partStates(state, a)) {
    const was = before.find((b) => b.id === p.id)!.state;
    if (was !== p.state) changed.push({ id: p.id, from: was, to: p.state });
  }
  const got = lost - c.hpLostPct, own = got / Math.max(1, opts.boost ?? 1);
  creditHealing(state, a, sourceId, own);
  creditHealing(state, a, HL.perk, got - own);
  if (src.moralePct) healed = restoreMorale(a, src.moralePct) !== 0 || healed; // MB8
  const to = healthLevel(a);
  if (!opts.quiet || to !== level || changed.length) logCode(state, 'healed', { actorId: a.id, source: sourceId, from: level, to, parts: changed, better: c.hpLostPct < lost || healed });
  return c.hpLostPct !== lost || healed;
}

/** Q3: would this source heal anything? A healing item isn't used up when it wouldn't. */
export function wouldHeal(state: GameState, a: Actor, sourceId: string): boolean {
  const src = getLibrary().healing?.[sourceId];
  if (!src) return false;
  const c = a.core.condition;
  if (healthLevel(a) === 'Dead' && !src.revivesDead) return false;
  if (c.hpLostPct > 0 && src.hpPct > 0) return true;
  if (moraleLost(a) > 0 && (src.moralePct ?? 0) > 0) return true;
  const reach = PART_STATES.pos(src.reach);
  return src.partPct > 0 && partStates(state, a).some((p) => p.id in c.parts && c.parts[p.id] < 100
    && PART_STATES.pos(PART_STATES.keyOf(p.state)!) <= reach);
}

/** H12–H14: hourly rows (natural recovery) heal every active actor on the stage for the game minutes that passed,
 * fights included. Off-stage healing waits for offscreen changes (D-67). */
export function passiveHealing(state: GameState, minutes: number): void {
  if (minutes <= 0) return;
  const stage = new Set(state.stage.zoneIds);
  const rows = Object.values(getLibrary().healing ?? {}).filter((h) => h.hourly);
  for (const a of [state.player, ...state.actors]) {
    if (!isActive(a) || (a !== state.player && !stage.has(a.zone))) continue;
    for (const h of rows) {
      if (h.hourly!.morale) { restoreMorale(a, trueSkill(a, h.hourly!.skill) * h.hourly!.pctPerPoint * (minutes / 60)); continue; } // MB34
      const boost = boostMult(a, h.hourly!.skill, 'recoveryMult'); // 40/80/120 perk: Quick Mend
      const pct = trueSkill(a, h.hourly!.skill) * h.hourly!.pctPerPoint * (minutes / 60) * boost;
      if (pct > 0) applyHealing(state, a, h.id, { pct, quiet: true, boost });
    }
  }
}
