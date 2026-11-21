// CONFIG defaults: the game clock, the world clock and sleep. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.

export const CLOCK = {
  // ---- game clock (T1-T8); how long each action takes is the library's Action times table (durations) ----
  /** AT35/AT74: the round, one exchange of blows: the one lever for short durations (perk marks, per-round limits). A code
   * ID only: the game never names it, it shows seconds */
  ROUND_S: 3,
  /** AE12/AT13: the most a fight turn lasts, in seconds, and the least (a turn lasts as long as the player's order) */
  FIGHT_TURN_S: 6,
  FIGHT_TURN_MIN_S: 3,
  /** AT20/TP4: carried time lasts this many turns, and each pool carries at most CARRY_MAX_TURNS fight turns of it */
  CARRY_TURNS: 2,
  CARRY_MAX_TURNS: 2,
  /** E1/YD6/AT72: an engagement ends, and hunting and engaged drop to tracking, after ENGAGEMENT_END with no blow or closing
   * in, worked out from the Action times table (ruleset/actionTime engagementEndS: the slowest attack cycle + one round).
   * TP10: never sooner than this many fight turns with no blow */
  ENGAGEMENT_END_MIN_TURNS: 3,
  /** AT46: the most a turn outside a fight lasts, in seconds (as long as the player's order); longer actions, walks, rests
   * and waits run on the world clock instead (AT45) */
  EXPLORE_TURN_S: 30,
  /** AT12 (placeholder): heavy armour put on or taken off alone takes this many times as long as with help */
  ARMOR_ALONE_MULT: 2,
  // ---- the world clock (AT56, AT65 to AT68; src/engine/comingNear.ts). Placeholders from the Action Time part three page.
  // The strike distance, the lever the page names STRIKE_M, is hostileNearM: HOSTILE_NEAR_STEP_M plus the closer's own
  // melee reach (SZ19, src/ruleset/gear.ts) ----
  /** AT67: seconds to get ready to act from each body pose (getting up off the floor takes 2 to 3 s) */
  READY_S: { lying: 3, sitting: 2, standing: 1 } as Record<import('../scales').BodyPoseKey, number>,
  /** AT67: seconds to take in what is happening and decide; the warning time is READY_S for the pose + DECIDE_S */
  DECIDE_S: 3,
  /** AT67: someone closing faster than this many times their kind's walk is rushing in, wherever they are heading */
  RUSH_SHARE: 1.5,
  /** AT67: someone accepted stops being accepted once more than this many times their trigger distance away */
  REARM_FACTOR: 2,
  /** AT67: a stretch of time steps at most half the shortest time anyone perceived needs to trigger the check, within these */
  STEP_MIN_S: 3,
  STEP_MAX_S: 60,
  /** NP1 a (placeholder, to be tested): only the NPCs relevant to the player are simulated in full each turn; the rest follow
   * their routines on the clock (src/engine/tiers.ts). false: everyone every turn, as before */
  ACTIVITY_TIERS: true,
  /** BG-231: a wait until someone appears stops after this many hours if no one comes */
  WAIT_SOMEONE_MAX_H: 8,
  TIME_OF_DAY_FROM: { dawn: 5 * 60, morning: 7 * 60, afternoon: 12 * 60, dusk: 18 * 60, evening: 20 * 60, night: 23 * 60 } as Record<string, number>, // minute of the day each starts (placeholders)
  SKY_LIGHT: { dawn: 'dim', morning: 'bright', afternoon: 'bright', dusk: 'dim', evening: 'moonlit', night: 'moonlit' } as Record<string, string>, // T3a: outdoor light by time of day (LIGHT keys); LT3: one flat night level until moon phases (parked)
  // NW12–NW22 sleeping (src/engine/sleep.ts). Placeholders: WAKE_GRADE, FALL_ASLEEP_MIN, SLEEP_STEP_MIN
  WAKE_NOISE: 'loud' as import('../scales').NoiseKey, // NW18: a sound this loud or louder wakes a sleeper who hears it (a shout is loud)
  WAKE_CONTACT: ['attack'] as string[], // NW14: a blow wakes the one it is aimed at, hit or miss
  /** NW19: the difficulty of a light sleeper's hearing check against someone moving openly, by their noise (louder is easier) */
  WAKE_GRADE: { faint: 'extreme', hushed: 'major', quiet: 'moderate', murmur: 'minor', normal: 'none', raised: 'none', loud: 'none', blaring: 'none', deafening: 'none' } as Record<string, import('../scales').GradeLevel>,
  BED_NEAR_M: 30, // BF68, BG-303: a real bed this many metres or less away by the walking path from one's own spots is one's bed when none was given (placeholder: about across a house and up its stairs)
  FALL_ASLEEP_MIN: 30, // NW20: an NPC woken falls asleep again by its routine no sooner than this
  NIGHT_MAX_MIN: 12 * 60, // NW22 b: a night shared out in watches lasts at most 12 hours
  SLEEP_STEP_MIN: 10, // NW12: a sleep is stepped this many minutes at a time, to stop when someone hostile arrives
  ROAD_DARK: ['dusk', 'evening', 'night'] as string[], // TV: road trips stop for the dark at these times of day
  TIME_TAGS: { dawn: ['day', 'night'], morning: ['day'], afternoon: ['day'], dusk: ['day', 'night'], evening: ['night'], night: ['night'] } as Record<string, string[]>, // T3b: routine-set time tags that fit
  REST_HEAL_PCT: 25,
  STARTING_BANDAGES: 2, // H2 (placeholder)
  CLINIC_HEAL_PCT: 100,
  /** NR34 (placeholders): Heal opens at this true Healing; it gives back this share of the target's missing health (and of
   * each part's missing share) by the Healing roll's tier, plus HEAL_PAST_STEP for each step past Critical Success.
   * Its cost is the action's own effort for now; a resource of its own (mana) comes later (D-340) */
  HEAL_UNLOCK: 50,
  HEAL_TIER_SHARE: { near_miss: 0.05, success: 0.1, great_success: 0.15, critical_success: 0.25 } as Record<string, number>,
  HEAL_PAST_STEP: 0.1,
  /** NR28: how much each band counts when code picks the closest role for the skills the World builder or Weaver wants */
  ROLE_WANT_SCORE: { high: 3, moderate: 2, low: 1 },
  ROLE_WANT_SKILLS: [2, 4] as [number, number], // NR28: a cast entry's wants name this many skills, fewest to most
  REST_MORALE_PCT: 50, // MB8: rest restores this share of max morale (composure table, CP.rest)
  CLINIC_MORALE_PCT: 100, // clinic care restores this share of max morale (composure table, CP.clinic)
};
