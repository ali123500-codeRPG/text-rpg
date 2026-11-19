// Skill groups as ratings (GR1–GR36): a skill group, or a compound row of groups (CONFIG.RATINGS), read as one number in
// skill points. Each skill's worth on the XP rating's curve (worth), highest first at 1, ½, ¼… (RATING_SHARE_STEP),
// summed into a pool; the pool read back in skill points (ratingOf), so a lone skill rates exactly itself and every
// further skill adds less. A skill counts in every group it names (GR35). Checks pool each skill's effective value
// (GR2: true × tier, gear lines, augments, age); `own` leaves the gear lines out and the gap is the gear portion (GR8).
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { groupsOf } from '../library/functionNames';
import { RT } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { effectiveSkill } from './gear';

/** a skill's worth (LF15): SKILL_RATING_AT_50 at 50, growing as the SKILL_RATING_POWER power of the skill, no cap */
export const worth = (s: number): number => CONFIG.SKILL_RATING_AT_50 * (Math.max(0, s) / 50) ** CONFIG.SKILL_RATING_POWER;
/** each place's share in a pool: 1, then × RATING_SHARE_STEP per place */
export const placeShare = (i: number): number => CONFIG.RATING_SHARE_STEP ** i;
/** GR1: the pool of a set of skill values: worths highest first at 1, ½, ¼… */
export const poolOf = (values: number[]): number => [...values].sort((a, b) => b - a).reduce((n, v, i) => n + worth(v) * placeShare(i), 0);
/** GR1: a pool read back in skill points (the worth curve's inverse) */
export const ratingOf = (pool: number): number => 50 * (Math.max(0, pool) / CONFIG.SKILL_RATING_AT_50) ** (1 / CONFIG.SKILL_RATING_POWER);

/** the skills of these groups (each skill once, in every group it names) */
export function skillsOfGroups(groups: string[]): string[] {
  return Object.values(getLibrary().skills).filter((d) => groupsOf(d).some((g) => groups.includes(g))).map((d) => d.id);
}

/** one skill in a rating: its value with gear and without (own), its place share and what its worth adds */
export type RatingPart = { skill: string; value: number; own: number; share: number; adds: number };
/** a rating: with gear, own (no gear lines), the gear portion (with − own) and its skills highest first */
export type Rating = { rating: number; own: number; gear: number; parts: RatingPart[] };

/** GR1/GR2/GR8: the rating of a set of groups (a group alone, or a CONFIG.RATINGS row), leaving out `without` */
export function ratingOfGroups(state: GameState, a: Actor, groups: string[], without: string[] = []): Rating {
  const rows = skillsOfGroups(groups).filter((id) => !without.includes(id)).map((skill) => {
    const e = effectiveSkill(state, a, skill, { alone: true });
    return { skill, value: Math.max(0, e.value), own: Math.max(0, e.value - e.items) };
  }).filter((r) => r.value > 0 || r.own > 0).sort((x, y) => y.value - x.value);
  const parts = rows.map((r, i) => ({ ...r, share: placeShare(i), adds: worth(r.value) * placeShare(i) }));
  const rating = ratingOf(parts.reduce((n, p) => n + p.adds, 0)), own = ratingOf(poolOf(rows.map((r) => r.own)));
  return { rating, own, gear: rating - own, parts };
}
/** a skill group's rating (GR29: every group has one) */
export const groupRating = (state: GameState, a: Actor, group: string): Rating => ratingOfGroups(state, a, [group]);
/** a compound rating (GR10 strength kinds, GR36 compound stats): the row's groups pooled as one */
export const compoundRating = (state: GameState, a: Actor, id: string, without: string[] = []): Rating => ratingOfGroups(state, a, CONFIG.RATINGS[id] ?? [], without);

/** GR11: the strength an action uses: the best of its kinds × the kind's share (CONFIG.STRENGTH_KINDS) */
export function strengthFor(state: GameState, a: Actor, action: string): { kind: string; value: number } {
  let best = { kind: '', value: 0 };
  for (const [kind, share] of Object.entries(CONFIG.STRENGTH_KINDS[action] ?? {})) {
    const value = compoundRating(state, a, kind).rating * share;
    if (value > best.value) best = { kind, value };
  }
  return best;
}
/** GR26: what strength adds to a Grapple roll to break free or hold on: STRENGTH_HOLD_SHARE × Melee strength with
 * Grapple left out of the pool (it already rolls), in skill points */
export const holdStrength = (state: GameState, a: Actor): number => CONFIG.STRENGTH_HOLD_SHARE * compoundRating(state, a, RT.melee_strength, [SK.unarmed_grapple]).rating;
