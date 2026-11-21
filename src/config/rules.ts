// CONFIG defaults: Part 1: skills, checks, growth and the shared ladders. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { SkillFunction } from '../types';
import type { GradeLevel } from '../scales';
import { FN } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { PAST_100 } from './past100';

export const RULES = {
  // ---- Part 1 ----
  /** a tree's All-XXX passive (and its mastery achievement) is earned once this many of its skills reach the step, by the
   * tree's rating (TREE_RATINGS; a tree with no rating is normal); null = never */
  ALL_STEP_SKILLS: { inferior: null, normal: 3, superior: 2, legendary: 1 } as Record<string, number | null>,
  SUBSTITUTE_EFFICIENCY: 0.3, // F4: was 0.5; perks can change it (PerkDef.standIn)
  /** Skill tiers: the final efficiency multiplier by SKILL_TIERS key. tier_1 is a placeholder. */
  SKILL_TIER_MULT: { tier_0: 0.5, tier_1: 0.75, tier_2: 1 } as Record<string, number>,
  /** A7 Open-Hand Guard: share of a hit through an open-hand block that lands on the blocking arm; the rest goes to the general area (placeholder) */
  OPEN_HAND_ARM_SHARE: 0.5,
  /** A6 Leg Bolt: the leg's pool takes this multiple of the damage the hit puts on the health track */
  LEG_BOLT_PART_MULT: 1.5,
  /** Per-check substitutes: a skill listed here replaces the flat SUBSTITUTE_EFFICIENCY with its own
   * table of skill functions and the share each substitute counts at. Grapple: other unarmed skills 0.4×, melee 0.2×.
   * Weapon (Arms) skills: other weapon skills at the flat 0.3×, unarmed skills 0.1×. */
  SUBSTITUTES: {
    [SK.unarmed_grapple]: [{ fn: FN.unarmed, k: 0.4 }, { fn: FN.arms, k: 0.2 }],
    [SK.melee_light]: [{ fn: FN.arms, k: 0.3 }, { fn: FN.unarmed, k: 0.1 }],
    [SK.melee_medium]: [{ fn: FN.arms, k: 0.3 }, { fn: FN.unarmed, k: 0.1 }],
    [SK.melee_heavy]: [{ fn: FN.arms, k: 0.3 }, { fn: FN.unarmed, k: 0.1 }],
  } as Record<string, { fn: SkillFunction; k: number }[]>,
  /** Pairs of skills that never stand in for each other, even when they share a function (the three defenses) */
  NO_STAND_IN: [[SK.dodge, SK.block], [SK.block, SK.parry], [SK.dodge, SK.parry]] as [string, string][],
  EVENT_BASE: 50,
  /** natural edges: the lowest and the highest this many d100 results shift any roll one tier down or up */
  NATURAL_EDGE: 5,
  /** event rolls: naturals per tier opened past Critical (tierUnlocks); each opened tier widens the natural critical range by this many */
  EVENT_CRIT_NATURALS: 5,
  /** Part 1 §4 margin bands: the lowest margin for each tier above Critical Failure (Failure −75, Near Miss −25, Success 0,
   * Great Success 25, Critical Success 75) */
  MARGIN_BANDS: [-75, -25, 0, 25, 75],
  /** D-211: width of each extra margin band a tier unlock opens past either end of the skill-roll table */
  TIER_EXTRA_BAND: 50,
  /** task grades: the skill that just manages a task (D-7 placeholders). mortal_limit and up are tasks past what a human
   * body can do (CR4); they are challenge rows only (CR12): no gain, lock or Weaver use until D-219 says when they apply */
  DIFFICULTY: { none: 20, minor: 35, moderate: 50, major: 65, extreme: 80, mortal_limit: 100, ...PAST_100 } as Record<GradeLevel, number>,
  SKILL_WEIGHT: 0.5,
  ROLL_NEEDED: 63.5,
  /** RN2 b: stacking within one modifier type (ruleset/stacking.ts powerStack): n equal modifiers total n^MOD_STACK_EXP, so the
   * k-th largest counts √k − √(k−1): 1, 0.41, 0.32, 0.27 … with no ceiling (placeholder) */
  MOD_STACK_EXP: 0.5,
  /** the quality lever: a minted weapon's hit bonus = QUALITY_HIT_FACTOR × its need × its quality (1–4) */
  QUALITY_HIT_FACTOR: 0.04,
  /** QE2: a minted weapon's damage boost = QUALITY_DAMAGE_FACTOR × need × quality × the mode's class factor × its tree factor */
  QUALITY_DAMAGE_FACTOR: 0.02,
  /** PLACEHOLDER (CE11): a weapon's damage grows with its need: (class damage + damageAdj) × (1 + DAMAGE_NEED_RATE × need),
   * +1% a point (library/gearScale.ts damageGrowth). A natural attack or a bare hand has no need: the attacker's skill
   * with it stands in (CE8), as Hide does for natural armor. A straight line, like armor's soak and health. */
  DAMAGE_NEED_RATE: 0.01,
  /** QE2 type levers: class factors follow class damage over medium's (20/25, 25/25, 30/25); melee and ranged start equal (placeholder) */
  DAMAGE_CLASS_FACTOR: { light: 0.8, medium: 1, heavy: 1.2 } as Record<string, number>,
  DAMAGE_TREE_FACTOR: { melee: 1, ranged: 1 } as Record<string, number>,
  /** the balance lever for all equipment: a standard-kit piece's bonus = EQUIP_FACTOR × its need (EQUIP_NEED) */
  EQUIP_FACTOR: 0.4,
  /** the armor lever (QE4): the damage armor stops = ARMOR_FACTOR × its need; the multiplier stays with its weight */
  ARMOR_FACTOR: 0.08,
  /** QE6: a minted armor piece stops ARMOR_QUALITY_FACTOR × its need × its quality more */
  ARMOR_QUALITY_FACTOR: 0.01,
  /** the shield pool levers (QE5): pool = POOL_BASE + POOL_FACTOR × its need */
  POOL_BASE: 20,
  POOL_FACTOR: 0.8,
  /** QE6: a minted shield's pool grows by POOL_QUALITY_FACTOR × its need × its quality */
  POOL_QUALITY_FACTOR: 0.1,
  POTENTIAL: 300,
  K: 20,
  /** D-374 TB1 (placeholders): how much of a skill's raw counts toward Burden's Total: 100 % less TAG_BURDEN_SELF_PCT for its
   * own tag, less TAG_BURDEN_GROUP_PCT per tagged skill sharing a group with it (itself included). A lone tag counts 0; two tags
   * in one group count below 0 and lower the Total */
  TAG_BURDEN_SELF_PCT: 95,
  TAG_BURDEN_GROUP_PCT: 5,
  /** D-374 TB5 (placeholder): each tagged skill adds this share of its true skill to the improvement rolls of every other
   * skill sharing a group with it (D-376: true skill or raw is checked at the balance pass) */
  TAG_GROUP_ROLL_SHARE: 0.05,
  /** SP2: a use marks its skill when the opposition is within ± this of raw or true skill (placeholder) */
  MARK_WINDOW: 10,
  /** SM1: the first mark on a skill in an engagement owes a roll, and so does every Nth mark after it (1: every mark;
   * 2: marks 1, 3, 5...). Infinity: one roll per skill per engagement. */
  MARK_STACK_EVERY: 1,
  /** SG1 C: the mortal limit raw skill can train to (Part 1 §6) */
  SKILL_CAP: 100,
  /** EG16: a tagged skill's cap is SKILL_CAP plus this (D-374 TB7: 25 -> 20, since the roll, not a hard limit, now ends training) */
  TAG_CAP_BONUS: 20,
  /** a flawed skill's cap is SKILL_CAP minus this */
  FLAW_CAP_PENALTY: 25,
  /** D-377 FC4 a (placeholder): each flawed skill adds this % to the Total share of every skill sharing a group with it,
   * itself included (the mirror of TAG_BURDEN_GROUP_PCT) */
  FLAW_BURDEN_GROUP_PCT: 5,
  /** SG1 C: an improvement roll's margin = d100 + (cap − raw − Burden + group bonus) − this (placeholder). D-374 TB7: 100, so
   * raw runs out at its cap (at raw = cap a natural 100 is margin 0, which gains nothing) */
  GROWTH_ROLL_NEEDED: 100,
  /** D-383 (placeholder): raw gained = margin ÷ this, rounded up; margin 0 or below gains nothing, so raw stops exactly where
   * the roll runs out */
  GROWTH_MARGIN_PER_POINT: 15,
  /** SG3 a: true = a skill's own cap (120 tagged, 75 flawed) is in the roll too, so the room left counts from it;
   * false = every skill rolls against SKILL_CAP and only its stop moves */
  GROWTH_CAP_IN_ROLL: true,
};
