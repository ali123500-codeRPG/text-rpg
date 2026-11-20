// CONFIG defaults: fatigue and stamina. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { EffortKey, FatigueLevel } from '../scales';

export const FATIGUE = {
  // ---- fatigue and stamina (FT1-FT28; src/ruleset/fatigue.ts, src/engine/fatigue.ts). All placeholders ----
  /** FT2: the stamina bar (both layers) = STAMINA_BASE + STAMINA_PER_POINT × Stamina, like HP from Endurance */
  STAMINA_BASE: 50,
  STAMINA_PER_POINT: 1,
  /** FT3/FT22: [FATIGUE_LEVELS key, from % of the long-term bar used, roll penalty in % of the average roll (type wounds, PW1 b), short line's band in %
   * of the bar]; collapsed = the bar is full */
  FATIGUE_TRACK: [
    ['rested', 0, 0, 100], ['fine', 15, 0, 90], ['tired', 30, -7, 80], ['weary', 45, -13, 65], ['exhausted', 60, -20, 50],
    ['drained', 75, -27, 35], ['dead_on_feet', 90, -40, 20], ['collapsed', 100, -40, 20],
  ] as [FatigueLevel, number, number, number][],
  /** FT17: others' fatigue shows (as words) from this level down */
  FATIGUE_SHOWN_FROM: 'exhausted' as FatigueLevel,
  /** FT4: each hour awake adds SLEEP_DEBT_FLAT points + SLEEP_DEBT_PCT % of the bar, × the body type's sleepNeed */
  SLEEP_DEBT_FLAT: 0.5,
  SLEEP_DEBT_PCT: 1.5,
  /** FT25: strain each effort tier pays (EFFORT keys) */
  STRAIN_COST: { base: 0, light: 0.5, moderate: 1, hard: 2, all_out: 4 } as Record<EffortKey, number>,
  /** FT24: an action row longer than this pays its tier per this many seconds it runs; a shorter one pays it once */
  STRAIN_LONG_S: 10,
  /** FT24: movement pays its tier per this many seconds moved: a walk (move time) at WALK_EFFORT, a run (a dash) at RUN_EFFORT */
  STRAIN_MOVE_S: 3,
  WALK_EFFORT: 'base' as EffortKey,
  RUN_EFFORT: 'hard' as EffortKey,
  /** FT5: a dodge, block or parry (no Action times row of its own) */
  DEFENSE_EFFORT: 'light' as EffortKey,
  /** FT23: strain past an empty short line spills into the long-term bar at this share */
  SPILL_SHARE: 0.5,
  /** SR4: every strain point paid also adds this share of itself to the long-term bar */
  STRAIN_RESIDUE: 0.1,
  /** FT27/FB6: one Stamina mark per this many points of strain paid, any effort, armour included */
  STAMINA_MARK_EVERY: 50,
  /** FT28: catching your breath: in a calm stretch (nothing above Light for BREATH_CALM_S) the line refills BREATH_BASE_PCT
   * + Stamina × BREATH_PER_POINT_PCT % of its size a minute */
  BREATH_CALM_S: 10,
  BREATH_BASE_PCT: 15,
  BREATH_PER_POINT_PCT: 0.05,
  /** FT7/FT8: sleep clears SLEEP_CLEAR_PCT % of the bar an hour × the spot (in a bed or not) × worn armour by weight */
  SLEEP_CLEAR_PCT: 4,
  SLEEP_SPOT_MULT: { bed: 1, elsewhere: 0.75 } as Record<string, number>,
  /** FT8, MQ13 a: someone going to sleep within this many metres of a free bed's footprint lies down on it (one step
   * from beside it; placeholder) */
  BED_REACH_M: 1,
  /** MQ18: how many sleepers one bed holds, side by side across it */
  BED_SLEEPERS: 2,
  SLEEP_ARMOR_MULT: { light: 1, medium: 1, heavy: 1 } as Record<string, number>, // sleeping in armour makes no difference (less realism; was 1 / 0.75 / 0.5)
  /** FT9: a sleep lasts until the long-term bar is clear, within these hours, or until a named time */
  SLEEP_MIN_HOURS: 1,
  /** SH1/SH2/SH4: a 120 perk adds HIGH_PERK_SHARE × its skill's true skill to that skill (instead of +5), and HIGH_PERK_SPREAD × it
   * to every skill sharing a group (in place of the 40 and 80 perks' +1). Placeholders */
  HIGH_PERK_SHARE: 0.05,
  HIGH_PERK_SPREAD: 0.01,
  /** Stamina perks and sleep quirks (SS1-SS14). All placeholders */
  CATNAP_SLEEP_HOURS: 1, // SS1 Catnap: a full rest clears the sleep debt this many hours of sleep would
  DEEP_RESERVES_MULT: 1.2, // LG8 Deep Reserves (Resolve 40): Endurance, Stamina and Resolve count this many times toward health, stamina and morale
  FEAR_BITES_MULT: 1.2, // LG12 Fear Bites Deeper (Intimidation 40): morale the owner makes others lose
  SHARP_ANSWER_MULT: 1.25, // LG2 Sharp Answer (Parry 40): damage of the owner's strike back after a parry, before armor
  DEEPER_SOAK_MULT: 1.5, // LG18 Deeper Soak (Heavy Armor 40): worn heavy armor's flat soak
  COVERED_JOINTS: -10, // LG24 Covered Joints (Medium Armor 40): an attack at a part the owner's armor covers; unaimed, × the share of hits its armor covers
  DEEP_LUNGS_LINE: 1.5, // SS4 Deep Lungs: the owner's short line is this many times its size
  SLEEPLESS_NEED: 0.2, // SS5 Sleepless: sleepNeed multiplier (hours awake add debt this many times as fast)
  BOTTOMLESS_STRAIN: 0.5, // SS6 Bottomless: every strain cost the owner pays is × this
  SECOND_BREATH_PCT: 50, // SS8 Second Breath: once per engagement an emptied line refills to this % of its size
  OVERDRIVE_SHARE: 0.1, // SS15 Overdrive (Stamina 140): while the line is above half, every roll adds this share of Stamina (the augment equation)
  PAYOFF_SHARE: 0.05, // CN4 payoff perks: one counted piece adds this share of the skill (placeholder)
  CHORUS_REACH_M: 1, // CN8 Chorus: metres of engagement-aura reach each shout piece adds in full (placeholder)
  PAYOFF_EXP: 0.8, // RN4 a / CN9 d: n pieces give PAYOFF_SHARE × n^PAYOFF_EXP (5, 8.7, 12, 15.2, 18.1% …; no ceiling; placeholder)
  OVERDRIVE_STRAIN: 1, // SS15 Overdrive: strain points each of those rolls costs (with worn armour and Bottomless)
  HEAVY_SLEEPER_STEPS: 1, // SS10 Heavy Sleeper: noise levels louder than WAKE_NOISE it takes to wake the owner
  INSOMNIAC_CLEAR: 0.75, // SS11 Insomniac: sleepClear multiplier
  SHORT_SLEEPER_CLEAR: 1.33, // SS13 Short Sleeper (banked, D-300): sleepClear multiplier
  SLEEP_MAX_HOURS: 24,
};
