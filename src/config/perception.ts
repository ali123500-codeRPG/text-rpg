// CONFIG defaults: making out and searching. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { GradeLevel } from '../scales';

export const PERCEPTION = {
  // ---- making out what is half seen or half heard (PG3-PG9; placeholders) ----
  /** PG4 a: a make-out roll's grade for something half seen: by how far past its clear range it is, as a share of the way
   * to its glimpse range (CONFIG.SIGHT_M), the first row whose share it is within */
  MAKE_OUT_SIGHT_GRADES: [[0.25, 'minor'], [0.5, 'moderate'], [0.75, 'major'], [1, 'extreme']] as [number, GradeLevel][],
  /** PG4 a: darkness where it happens makes the sight grade this many steps harder (Night Eyes cancels it) */
  MAKE_OUT_DARK_STEPS: 1,
  /** PG4 a: a make-out roll's grade for something half heard: by the decibels it reaches above HEARING_FLOOR_DB, the first
   * row it reaches (clear starts at CLEAR_ABOVE_FLOOR_DB, 15) */
  MAKE_OUT_SOUND_GRADES: [[11, 'minor'], [7, 'moderate'], [3, 'major'], [0, 'extreme']] as [number, GradeLevel][],
  // ---- searching (SE20, SE21, SE24, SA8; placeholders) ----
  /** SE20: what one search covers outside a fight at the base skill: the game's room size (a tavern common room) */
  SEARCH_AREA_M2: 60,
  /** SE21 b: the search area grows in a straight line with the rolling sense's effective skill: area × skill ÷ this */
  SEARCH_AREA_SKILL_BASE: 50,
  /** SE24: a searchReach reward adds this many m² of search area per metre */
  SEARCH_M2_PER_REACH_M: 120,
  /** LX2: a search's circle never has a smaller radius than this (in a fight or out of one, LX3) */
  SEARCH_MIN_RADIUS_M: 2,
  /** SE14 b: Look at and Listen are also a search against anyone hiding in their range, this many tiers down (a Search uses SEARCH_RING_SHIFTS) */
  LOOK_SEARCH_SHIFT: -1,
  /** LX5 b: a Search's checks beyond its search area: the first ring reaches this many times the search radius, the second
   * from there out to the look's reach (clear sight, 25 m) */
  SEARCH_RING1_RADII: 2,
  /** LS2 a: the sound someone hiding still makes (breathing, cloth): the noise table's faint, 20 dB at 1 m */
  HIDE_STILL_NOISE: 'faint' as import('../scales').NoiseKey,
  /** LX8 a: tiers on a Search's roll against a hider inside its search area, so searching beats waiting (placeholder) */
  SEARCH_AREA_SHIFT: 1,
  /** LX5/LX8 a: tiers on the searcher's roll in the first and second ring beyond the search area (placeholders) */
  SEARCH_RING_SHIFTS: [0, -1] as [number, number],
  WARNED_SHIFT: 2, // WN3: tiers on an answer to a lie (Insight) by one that knows the trick (saw through it, or was warned)
  POINTED_SHIFT: 1, // WN4 b (placeholder): tiers on the next notice or search roll at a hidden foe an ally pointed out
  POINTED_TURNS: 6, // WN4 b (placeholder, = DECAY_TURNS): how long a pointed-out spot stays fresh
  /** SE25: what an item search learns against when no one did the hiding (a Weaver-hidden item, concealed gear): a
   * hidden-at tier counts as this skill at Success, and this much more for each tier step above it (less below, never under 0) */
  HIDDEN_TIER_SUCCESS_SKILL: 50,
  HIDDEN_TIER_SKILL_STEP: 25,
  /** ST21: which situation tags each situational table reaches, and the sign (+ helps the roll's owner).
   * light adds sign × lightMod(the light where the action is) to the roll; cover is sign × coverMod (CV6, CV7: what shows of
   * the body there) on the roll. A skill's tags are in the library (SkillDef.tags); linking a table is a row here. */
  SITUATION_TAGS: { light: { sight: 1, stealth: -1 }, cover: { hide: 1, ranged: -1 } } as Record<'light' | 'cover', Partial<Record<import('../types').SituationTag, number>>>,
};
