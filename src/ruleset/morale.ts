// The morale bar (MB1–MB43): a second, mental health bar. Max morale comes from Resolve as HP comes from Endurance;
// fears cost flat points (the library fears table); the level is the share of max morale lost (CONFIG.MORALE_TRACK).
import type { Actor, FearDef, Mod, PartDef } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { SK } from '../library/skillIds';
import { HEALTH_LEVELS, MORALE_LEVELS, PART_STATES, TIERS, type HealthLevelKey, type MoraleLevel, type PartStateKey } from '../scales';
import { skillOpen } from './access';
import { achievementMaxMorale, currentAchievements } from './achRewards';

/** MB29: max morale = MORALE_BASE + MORALE_PER_RESOLVE × Resolve (raw, like Endurance for HP), plus the flat points the
 * actor's current achievements add (AchievementDef.maxMorale) */
export function maxMorale(a: Actor): number {
  const r = a.core.skills[SK.resolve];
  return CONFIG.MORALE_BASE + CONFIG.MORALE_PER_RESOLVE * (r && !r.dormant && skillOpen(a, SK.resolve) ? r.raw : 0) + achievementMaxMorale(a);
}
export const moraleLost = (a: Actor): number => a.core.condition.moraleLost ?? 0;
/** share of max morale lost, in % */
export const moraleLostPct = (a: Actor): number => (100 * moraleLost(a)) / maxMorale(a);

export function moraleLevel(a: Actor): MoraleLevel {
  const pct = moraleLostPct(a);
  return CONFIG.MORALE_TRACK.find(([, max]) => pct <= max)![0] as MoraleLevel;
}
export const isBrokenLevel = (l: MoraleLevel): boolean => l === 'broken';
/** MB3/MB35: the level's roll penalty, type wounds, so it shrinks together with health wounds; it also hits the morale roll */
export function moraleMods(a: Actor): Mod[] {
  const l = moraleLevel(a);
  const v = CONFIG.MORALE_TRACK.find(([k]) => k === l)?.[2] ?? 0;
  return v ? [{ source: `morale: ${MORALE_LEVELS.name(l)}`, type: 'wounds', value: v }] : [];
}
/** MB16: others' morale shows from CONFIG.MORALE_SHOWN_FROM down */
export const moraleShows = (l: MoraleLevel): boolean => MORALE_LEVELS.pos(l) >= MORALE_LEVELS.pos(CONFIG.MORALE_SHOWN_FROM as MoraleLevel);

/** MB21: the health level a health fear starts from, moved by the owner's perks and achievements (fearFrom) */
export function fearFrom(a: Actor, f: FearDef): number {
  const perks = getLibrary().perks ?? {};
  const steps = [...a.core.perks.filter((p) => !p.dormant).map((p) => perks[p.perkId]?.fearFrom), ...currentAchievements(a).map((x) => x.d.fearFrom)]
    .reduce((n, x) => n + (x && x.fear === f.id ? x.steps : 0), 0);
  return HEALTH_LEVELS.pos(f.health!.from) + steps;
}
/** the health fear (if any) a new health level sets off: the row whose from..to range holds it */
export function healthFear(a: Actor, level: HealthLevelKey): FearDef | undefined {
  const at = HEALTH_LEVELS.pos(level);
  return Object.values(getLibrary().fears ?? {}).find((f) => f.health && at >= fearFrom(a, f) && at <= HEALTH_LEVELS.pos(f.health.to));
}

/** the part fears a hit sets off, each with the parts that reached (or passed) its state from a better one.
 * before and after are part states as partStates gives them. */
export function partFears(before: { id: string; state: PartStateKey }[], after: { id: string; state: PartStateKey }[]): { fear: FearDef; parts: string[] }[] {
  const was = new Map(before.map((p) => [p.id, PART_STATES.pos(p.state)]));
  return Object.values(getLibrary().fears ?? {}).flatMap((f) => {
    if (!f.part) return [];
    const at = PART_STATES.pos(f.part);
    const parts = after.filter((p) => { const from = was.get(p.id); return from !== undefined && from < at && PART_STATES.pos(p.state) >= at; }).map((p) => p.id);
    return parts.length ? [{ fear: f, parts }] : [];
  });
}
/** what a part fear costs before its roll: each part's impact cost (partCost, or another row's × mult) × refParts ÷ the body's part count, summed */
export function partFearCost(f: FearDef, hit: string[], body: PartDef[]): number {
  const base = f.partCostOf ? getLibrary().fears?.[f.partCostOf.fear] : f;
  const mult = f.partCostOf?.mult ?? 1;
  if (!base?.partCost || !body.length) return f.cost;
  const scale = (base.refParts ?? body.length) / body.length;
  return hit.reduce((n, id) => { const p = body.find((x) => x.id === id); return n + (p ? base.partCost![p.impact] * scale * mult : 0); }, 0);
}

/** sets morale lost, kept between 0 and max morale (Broken is 100 %); returns the change */
export function setMoraleLost(a: Actor, lost: number): number {
  const before = moraleLost(a);
  a.core.condition.moraleLost = Math.max(0, Math.min(maxMorale(a), lost));
  return a.core.condition.moraleLost - before;
}
/** restores `pct` % of max morale (MB8, MB9, MB34) */
export const restoreMorale = (a: Actor, pct: number): number => setMoraleLost(a, moraleLost(a) - (pct / 100) * maxMorale(a));

/** a rolled fear's cost multiplier by tier level (unclamped: each step below Critical Failure adds MORALE_BEYOND_CF) */
export function tierCostMult(level: number): number {
  if (level < 0) return CONFIG.MORALE_TIER_MULT.critical_failure + CONFIG.MORALE_BEYOND_CF * -level;
  return CONFIG.MORALE_TIER_MULT[TIERS.at(level)] ?? 0;
}
