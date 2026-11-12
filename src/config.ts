import type { DefenseKind, SkillFunction } from './types';
import type { GradeLevel, HealthLevelKey, NoiseKey, QualityKey, QuestRewardLevel } from './scales';
import { FN, GR } from './library/functionIds';
import { SK } from './library/skillIds';
// Every tunable value. Spec "placeholder" values are config, not constants.
// Values marked Q2 are placeholders the spec names without a value (asked in the build plan, question 2).
// Read CONFIG at call time (tests may change a value and call resetConfig()).

const DEFAULTS = {
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
  /** D-211: width of each extra margin band a tier unlock opens past either end of the skill-roll table */
  TIER_EXTRA_BAND: 50,
  /** task grades: the skill that just manages a task (D-7 placeholders). mortal_limit and up are tasks past what a human
   * body can do (CR4); they are challenge rows only (CR12): no gain, lock or Weaver use until D-219 says when they apply */
  DIFFICULTY: { none: 20, minor: 35, moderate: 50, major: 65, extreme: 80, mortal_limit: 100, beyond: 150, mythic: 200, divine: 300 } as Record<GradeLevel, number>,
  SKILL_WEIGHT: 0.5,
  ROLL_NEEDED: 63.5,
  /** stacking within one modifier type: the x-th largest counts at STACK_RATIO^(x−1), so 1, 0.5, 0.25, 0.125 … */
  STACK_RATIO: 0.5,
  /** the quality lever: a minted weapon's hit bonus = QUALITY_HIT_FACTOR × its need × its quality (1–4) */
  QUALITY_HIT_FACTOR: 0.04,
  /** QE2: a minted weapon's damage boost = QUALITY_DAMAGE_FACTOR × need × quality × the mode's class factor × its tree factor */
  QUALITY_DAMAGE_FACTOR: 0.02,
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
  /** SP2: a use marks its skill when the opposition is within ± this of raw or true skill (placeholder) */
  MARK_WINDOW: 10,
  /** SM1: the first mark on a skill in an engagement owes a roll, and so does every Nth mark after it (3: marks 1, 4, 7...).
   * Infinity: one roll per skill per engagement. */
  MARK_STACK_EVERY: 3,
  /** a successful improvement roll adds 1d(this) raw */
  SKILL_GAIN_DIE: 3,
  /** SP5: a hit costing this much health (%) or more marks endurance (placeholder) */
  ENDURANCE_MARK_PCT: 10,
  // ---- Part 3 ----
  HP_BASE: 50,
  HP_PER_END: 1,
  HEALTH_SHOWN_FROM: 'wounded' as HealthLevelKey, // others' health level shows from this level down (Voyage C2)
  /** health % lost stops here: Dead at 150% */
  HP_LOST_MAX: 150,
  HEALTH_TRACK: [
    // [HEALTH_LEVELS key, max % lost, wounds modifier], in the scale's order
    ['unhurt', 0, 0], ['bruised', 15, 0], ['hurt', 30, -5], ['injured', 45, -10],
    ['wounded', 60, -15], ['mauled', 75, -20], ['critical', 99.999, -30], ['incapacitated', 149.999, 0],
    ['dead', Infinity, 0], // dead at 150% lost (was 200%); the player's own Dead is never shown; others clearly seen show Dead
  ] as [HealthLevelKey, number, number][],
  PART_SHARE: { tiny: 0.15, extra_small: 0.15, small: 0.2, normal: 0.3, big: 0.5 } as Record<string, number>,
  HIT_WEIGHT: { tiny: 0.25, extra_small: 0.5, small: 1, normal: 2, big: 4 } as Record<string, number>,
  AIM_PENALTY: { tiny: -40, extra_small: -35, small: -30, normal: -20, big: -10, general: 0 } as Record<string, number>,
  GENERAL_MIN_PCT: 30,
  GENERAL_BIG_WEIGHT: 4,
  IMPACT_MULT: { non_essential: 0, normal: 1, essential: 1.5 } as Record<string, number>,
  ROLE_PENALTY: { damaged: -10, crippled: -20 },
  ESSENTIAL_CRIPPLED_PENALTY: -5, // wounds on every roll while any essential part (head, neck …) is Crippled or worse; once, however many
  SHARED_ROLE_OFF_PCT: 0.6,
  WEAPON_CLASSES: {
    light: { damage: 20, hit: 10 }, medium: { damage: 25, hit: 0 }, heavy: { damage: 30, hit: -10 },
    punch: { damage: 15, hit: 10 }, slam: { damage: 20, hit: 10 },
    grapple: { damage: 5, hit: 0 }, // grab and wrench (placeholder): anyone can grapple; Hold (A8) locks on
  } as Record<string, { damage: number; hit: number }>,
  UNARMED_PROFILE: { damage: 15, hit: 10 },
  HEAVY_VS_BLOCK_GAP: -1, // a heavy melee blow is harder to stop: gap shift against Block and Parry
  PARRY_STRIKE_GAP: 3, // PA3/PA4: a parry at this gap or better stops the blow fully and earns a free strike back
  ANSWER_THE_BLOW_DROP: 2, // PA7: Answer the Blow lowers the strike's gap by this much when parrying with a medium weapon
  // the ladder runs GAP_MIN..GAP_MAX; a gap past either end uses the end row. −6..−10 are placeholders (+0.5 a step)
  GAP_MIN: -10,
  GAP_MAX: 5,
  GAP_LADDER: {
    dodge: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1.375, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.8, 2: 0, 3: 0, 4: 0, 5: 0 },
    block: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1, [-2]: 1, [-1]: 1, 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0.2, 5: 0.15 },
    // PA3 (placeholders): cuts less than Block at small gaps, stops the blow fully from +3; a failed parry punishes harder
    parry: { [-10]: 5, [-9]: 4.5, [-8]: 4, [-7]: 3.5, [-6]: 3, [-5]: 2.5, [-4]: 2, [-3]: 1.5, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.85, 2: 0.65, 3: 0, 4: 0, 5: 0 },
  } as Record<DefenseKind, Record<number, number>>,
  DODGE_VS_MISSILE: 10,
  OUTNUMBERED_MOD: -5, // Q2 (D-76)
  UNAWARE_MOD: -10, // Q2 (D-76)
  INIT_UNAWARE: 0, // Q2: unaware actors act last
  OVERWHELM_TIERS: 3, // MR4 Overwhelm: an aura roll lost by this many tiers or more can overwhelm
  OVERWHELM_MORALE_SHARE: 0.5, // ... a target whose max morale is at most this share of the owner's
  AURA_REACH_M: 8, // I3/RD1: metres an engagement aura reaches (today's one zone link); the aura skill sets it once RD9's formula is chosen (D-193)
  ENGAGEMENT_END_TURNS: 3, // E1: an engagement ends after this many turns with no one engaged with the actor; YD6: hunting and engaged drop to tracking after this many turns with no blow or closing in
  SPAR_LIMIT: 'critical' as HealthLevelKey, // SP4 (placeholder): a fighter at this health level or worse is out of the spar; a cruel spar uses Incapacitated
  /** ranged attacks: the penalty by how far the target is as a share of the mode's reach (both from real metres), first
   * band the share fits in; a longbow at 50 m is barely stretched, a shortbow at 50 m is at its limit */
  RANGE_SHARE_MODS: [[0.25, 0], [0.5, -5], [0.75, -10], [1, -15]] as [number, number][],
  HOSTILE_NEAR_MOD: -10, // a ranged attack with a hostile within HOSTILE_NEAR_M of the shooter (Point Blank removes it)
  HOSTILE_NEAR_M: 2, // RD5: close enough to strike or grab the shooter (a step and a blow)
  LIGHT_MODS: { bright: 0, dim: -5, dark: -10 } as Record<string, number>, // keyed by LIGHT key
  COVER_GAP: { none: 0, some: 1, heavy: 2 } as Record<string, number>, // keyed by COVER key
  /** loudness of each NOISE level in decibels at 1 m, from real references (the library's noiseLevels rows); null = no sound */
  NOISE_DB: { silent: null, faint: 20, hushed: 30, quiet: 40, murmur: 50, normal: 60, raised: 70, loud: 88, blaring: 100, deafening: 120 } as Record<string, number | null>,
  /** hearing (perception/noise.ts, BG-57, HB1–HB5): a sound weakens 20·log10(metres) with distance (the inverse-square
   * law, never nearer than SAME_ZONE_M) and loses SOUND_LOSS_DB at each crossing on its way, by the least-loss route. It is
   * heard while at least the listener's background (HB1) and heard clearly (who and what) from CLEAR_ABOVE_BACKGROUND_DB
   * over it: ANSI/ASA S12.60 asks a classroom's speech to stand 15 dB over its background. */
  SAME_ZONE_M: 1,
  CLEAR_ABOVE_BACKGROUND_DB: 15,
  /** HB6: every background counts at this share of its sourced decibels (BACKGROUND_DB), a game lever */
  BACKGROUND_SCALE: 0.5,
  /** HB8: a whisper to someone within WHISPER_REACH_M is said leaning in, WHISPER_LEAN_M from their ear (an estimate:
   * no measured leaning distance was found) */
  WHISPER_REACH_M: 1,
  WHISPER_LEAN_M: 0.3,
  /** HB2: background loudness per BACKGROUND level, dB(A): still 10 (Haleakala crater, NPS), hush 20 (light wind in trees,
   * Québec; a remote Grand Canyon trail, NPS), calm 35 (a very quiet room, Seattle), quiet 40 (a library or a quiet street
   * at night, Québec), lived-in 45 (the noise of normal living, Seattle), busy 60 (normal conversation, Québec, NPS), street
   * 70 (a busy street, Québec), crowded 81 (the average of 1,800+ New York bars in the evening, acoustics.org) */
  BACKGROUND_DB: { still: 10, hush: 20, calm: 35, quiet: 40, lived_in: 45, busy: 60, street: 70, crowded: 81 } as Record<string, number>,
  /** a zone with no kind (hand-built test worlds) and no background of its own */
  DEFAULT_BACKGROUND: 'quiet' as import('./scales').BackgroundKey,
  /** HB4: decibels lost at each crossing, by SOUND_LOSS level: an open gap nothing; a shut window about 30, a shut door about
   * 30, a wall about 35 (their sound transmission class, STC) */
  SOUND_LOSS_DB: { open: 0, window: 30, door: 30, wall: 35 } as Record<string, number>,
  /** sight (perception sightReach): how far each VISIBILITY level is made out clearly (who and what) and glimpsed
   * (something, not who), in metres, in daylight with a clear view, from real references (the library's
   * visibilityLevels rows); null = nothing to see. Links come from the same metres-to-links conversion as reach; an
   * event closer than SAME_ZONE_M can't be seen at that grade even in the same zone. A dark zone caps sight at partial. */
  SIGHT_M: { unseen: null, faint: [0.5, 2], close: [6, 20], low: [15, 60], normal: [25, 200], high: [50, 500], glaring: [200, 2000] } as Record<string, [number, number] | null>,
  /** ST21: which situation tags each situational table reaches, and the sign (+ helps the roll's owner).
   * light adds sign × LIGHT_MODS[the light where the action is] to the roll; cover is sign × COVER_GAP[the zone's cover]
   * in tiers (a ranged attack: a gap shift). A skill's tags are in the library (SkillDef.tags); linking a table is a row here. */
  SITUATION_TAGS: { light: { sight: 1, stealth: -1 }, cover: { hide: 1, ranged: -1 } } as Record<'light' | 'cover', Partial<Record<import('./types').SituationTag, number>>>,
  // ---- morale bar (MB1–MB43; placeholders) ----
  /** max morale = MORALE_BASE + MORALE_PER_RESOLVE × Resolve (MB29), like HP from Endurance */
  MORALE_BASE: 50,
  MORALE_PER_RESOLVE: 1,
  /** PL3, PL20: raw Resolve where each Nerve tier starts (one per NERVE_LINES row); 100 and up is superhuman */
  NERVE_TIER_FROM: [0, 20, 40, 60, 80, 100],
  /** PL20 [Proposed]: past the last tier, every this much more Resolve adds a + to its name */
  NERVE_BEYOND_STEP: 50,
  /** PL2, PL3: a Nerve or trait value leans (counts) at this distance from 0 or more */
  PERSONALITY_LEAN: 20,
  /** PL9: the word before a trait, from its distance from 0: [from, word] (below the first, the trait is left out) */
  TRAIT_WORDS: [[20, 'a bit '], [40, ''], [70, 'very ']] as [number, string][],
  /** PL10: at most this many named types are given to the agent, strongest first */
  PERSONALITY_TYPES_SHOWN: 2,
  /** PL12: the Nerve points a named line sets (− for cautious, + for daring) */
  NERVE_LINE_POINTS: 40,
  /** AP2: personality points one achievement step is worth; rows write steps (+1, −1), so this one number scales them all */
  ACH_PERSONALITY_STEP: 5,
  /** [MORALE_LEVELS key, max % of max morale lost, roll penalty (type wounds, MB3)]; broken = out of the fight */
  MORALE_TRACK: [
    ['calm', 0, 0], ['uneasy', 15, 0], ['tense', 30, 0], ['rattled', 45, -5], ['afraid', 60, -5],
    ['terrified', 75, -10], ['panicking', 99.999, -15], ['broken', Infinity, 0],
  ] as [string, number, number][],
  /** MB6: a rolled fear's cost × this, by the morale roll's tier; each step below Critical Failure adds MORALE_BEYOND_CF */
  MORALE_TIER_MULT: { critical_failure: 2, failure: 1.5, near_miss: 1, success: 0.5, great_success: 0.25, critical_success: 0 } as Record<string, number>,
  MORALE_BEYOND_CF: 0.5,
  /** MB9: share of max morale back when an actor's engagement ends */
  MORALE_ENGAGEMENT_END_PCT: 25,
  /** a single loss of this % of max morale or more marks the player's Resolve (like ENDURANCE_MARK_PCT) */
  RESOLVE_MARK_PCT: 10,
  /** others' morale shows (as words) from this level down (MB16), like HEALTH_SHOWN_FROM */
  MORALE_SHOWN_FROM: 'afraid',
  REST_COOLDOWN_MIN: 240, // T7: game minutes between rests (placeholder)
  // ---- game clock (T1-T8); durations per action are the library's durations table ----
  TIME_OF_DAY_FROM: { dawn: 5 * 60, day: 7 * 60, dusk: 18 * 60, night: 20 * 60 } as Record<string, number>, // minute of the day each starts (placeholders)
  SKY_LIGHT: { dawn: 'dim', day: 'bright', dusk: 'dim', night: 'dark' } as Record<string, string>, // T3a: outdoor light by time of day (LIGHT keys)
  TIME_TAGS: { dawn: ['day', 'night'], day: ['day'], dusk: ['day', 'night'], night: ['night'] } as Record<string, string[]>, // T3b: routine-set time tags that fit
  REST_HEAL_PCT: 25,
  STARTING_BANDAGES: 2, // H2 (placeholder)
  CLINIC_HEAL_PCT: 100,
  REST_MORALE_PCT: 50, // MB8: rest restores this share of max morale (composure table, CP.rest)
  CLINIC_MORALE_PCT: 100, // clinic care restores this share of max morale (composure table, CP.clinic)
  // ---- Part 4 ----
  POINTS_PER_LEVEL: 10, // 10 × level (was 3)
  CREATION_POINTS: 250,
  START_LEVEL: 4, // EQ13: the player starts at level 4
  CREATION_MAX_SKILL: 60,
  // Character age (AG1–AG22; placeholders)
  YEAR_DAYS: 365, // AG2: game days in a year; age = (today − birth day) ÷ YEAR_DAYS
  AGE_PLUS_NUMBER_FROM: 4, // AG7: from this many steps past the last life stage the name reads "Ancient +4" instead of "Ancient++++"
  AGE_DECLINE_FROM: 'stage_4' as import('./scales').LifeStageKey, // AG17: decline starts at the start of Old
  AGE_DECLINE_GROUPS: [GR.melee, GR.ranged, GR.defense, GR.health, GR.stealth, GR.notice] as string[], // AG19: body skills and the senses
  CREATION_AGE_DEFAULT: 20, // AG15: the creation picker's default (a start may set its own, ClassDef.creation.age)
  NPC_AGE_STAGES: ['stage_2', 'stage_3'] as import('./scales').LifeStageKey[], // AG13: the stages an NPC is drawn from when its template names none
  CREATION_TAGS: 3,
  STARTING_COIN: 20,
  // Trade (D-93, PY4–PY10; placeholders): price = base × MARKUP × haggle × Hard Bargain, rounded up, at least 1
  TRADE_MARKUP: 2,
  HAGGLE_WIN: 0.8, // a won barter contest against a seller, until the engagement ends
  HAGGLE_BAD_LOSS: 1.2, // lost by HAGGLE_BAD_GAP tiers or more
  HAGGLE_BAD_GAP: 2,
  // OQ-29: losing a speech contest leaves the listener Shaken (intimidation) or Swayed (persuasion) toward the speaker until
  // its engagement ends: a roll modifier of −(this × the tier gap) (placeholders)
  SHAKEN_PER_TIER: 5,
  SWAYED_PER_TIER: 5,
  /** NT3: each earlier try of the same speech kind at the same listener this engagement, on the speaker's roll */
  REPEAT_TRY: 15,
  HARD_BARGAIN_BUY: 0.9,
  HARD_BARGAIN_SELL: 1.1,
  SELL_SHARE: 0.5, // SL1: a Trader pays this share of an item's value (rounded down, at least 1)
  TRADER_PURSE: 50, // SL3: coin every Trader carries when the Weaver places it
  QUALITY_PRICE_FACTOR: 2, // SL8: a minted item's value is its base value × this × its quality (1–4)
  /** SL12 b / SL14: the coin each benefit number is worth; an item's value is its benefits summed (src/ruleset/value.ts).
   * skillPoint: per point of skill bonus (a roll bonus counts as the skill points that move a roll as much);
   * reachZone: per zone of reach (its best attack mode); armorStop: per point of damage stopped, per part covered;
   * armorCut: per percent of damage cut by the armor multiplier, per part covered; poolPoint: per point of a shield or armor pool */
  ITEM_VALUE: { skillPoint: 1, reachZone: 5, armorStop: 2, armorCut: 0.1, poolPoint: 0.25 },
  ORDER_NOISE: 'normal' as NoiseKey, // RD2: an order is called out in a normal voice; the seller must hear it clearly (trade hearsOrder)
  WARES_CAP: 8, // goods lines plus services per seller
  // PY9: coin is one unit in the game; narration names it in these coins, largest first
  COIN_NAMES: [['gold', 100], ['silver', 10], ['copper', 1]] as [string, number][],
  TURN_RECORDS_KEPT: 20, // N, Q2
  BACKUP_EVERY: 10, // Q2
  BACKUPS_KEPT: 3, // Q2
  HISTORY_CHUNK_TURNS: 20, // Q18: story text saved in documents of this many turns each
  LOCK_LEASE_MS: 60_000, // Q2
  SCHEMA_VERSION: 7, // v2: tiers stored as IDs; v3: every ordered scale stored by key (src/scales.ts); v4: humanoids have two legs; v5: hostile split from opposed; v6: memory notes become memory lists (PM1); v7: event noise and visibility stored by key
  // ---- Part 5 ----
  ACCESSORY_SLOTS: 3,
  /** armor multiplier by weight; the damage it stops comes from ARMOR_FACTOR × need (QE4) */
  ARMOR_MULTIPLIER: { light: 0.8, medium: 0.65, heavy: 0.55 } as Record<string, number>,
  /** EQ9: true skill each equipment level needs, Masterwork ending at 100 (even steps, placeholders) */
  EQUIP_NEED: { crude: 0, common: 25, fine: 50, superior: 75, masterwork: 100 } as Record<string, number>,
  /** EQ12 c: every roll with an item you fall short on is one outcome step worse per this many points short (or part of it) */
  EQUIP_SHORT_STEP: 10,
  ARMOR_DODGE: { light: -5, medium: -10, heavy: -20 } as Record<string, number>,
  // GAP (placeholders, AN1–AN4): worn armor makes body-moving events this many NOISE steps louder, per
  // ARMOR_WEIGHTS key. Moving stealthily doesn't cancel it. Quieter-armor perks come later (AN5).
  ARMOR_NOISE_STEPS: { light: 0, medium: 1, heavy: 2 } as Record<string, number>,
  QUALITY_TABLE: {
    tool: { quality_1: 5, quality_2: 10, quality_3: 15, quality_4: 20 } as Record<QualityKey, number>,
  },
  /** EQ11: a minted item of this quality or better is one equip level above its base */
  QUALITY_LEVEL_UP_FROM: 'quality_3' as QualityKey,
  STALL_TURNS: 8, // placeholder (P7c): quiet turns with no beat left before a new scenario
  /** SC2 levers per scenario scale (placeholders), keyed by SCENARIO_SCALES key: the turn budget (fight turns excluded) or, for
   * the biggest, a budget in game days; and how many places a plan of that scale may hold (code raises the scale to fit) */
  SCENARIO_SCALE: {
    moment: { budgetTurns: 12, places: 1 },
    situation: { budgetTurns: 40, places: 2 },
    episode: { budgetTurns: 120, places: 4 },
    venture: { budgetDays: 3, places: Infinity },
  } as Record<string, { budgetTurns?: number; budgetDays?: number; places: number }>,
  /** SC4: scales from this one up hold smaller scenarios inside them, one level deep */
  SCENARIO_HOLDS_FROM: 'episode',
  /** SC7: how many endings a scenario plan lists */
  SCENARIO_ENDINGS_MIN: 2,
  SCENARIO_ENDINGS_MAX: 3,
  /** SC6: scenario records kept in the save, and how many the next Weaver gets */
  SCENARIO_RECORDS_SAVED: 30,
  SCENARIO_RECORDS_SHOWN: 5,
  /** SC8 Weaver check-ins (placeholders): at least this many turns apart, and at most this many per scenario (/stuck and the over-time check-in excepted, BG-42) */
  CHECKIN_GAP_TURNS: 5,
  CHECKIN_MAX_PER_SCENARIO: 6,
  /** SC12: at this many times its budget, code ends the scenario as worn out (after any fight or chase) and files a bug */
  SCENARIO_OVERRUN_MULT: 2,
  /** SD2 a: scenario endings (SCENARIO_ENDINGS) after which free roam starts instead of the next scenario. Every ending for now, so
   * players can explore the world; broken_off is a knock-out, whose wake-up is always a new scenario */
  ROAM_AFTER: ['resolved', 'lost', 'left', 'escaped', 'interrupted', 'worn_out'] as string[],
  /** FR1 b (placeholder): a calm start (talk, trade, a quest goal reached) starts a scenario only once free roam has lasted this
   * many turns; danger (an attack, a hostile spotting the player), road encounters and unbuilt frontiers never wait */
  ROAM_MIN_TURNS: 5,
  /** D-226 (LF3): while a scenario runs, the player's achievements and All-XXX steps wait for the scenario's end and are
   * granted there together (one gains summary for the ending moment); in free roam they come at once. false: at once always */
  GROWTH_AT_SCENARIO_END: true,
  /** EG7/EG13 (growth proposal): improvement rolls a scenario pays at its end = round(owed rolls marked in it × this share, by
   * the scenario's event-roll tier, × the ending's factor), plus GROWTH_ROLLS_PAST_CRIT per step past Critical Success
   * (placeholders). Marks never roll on their own while GROWTH_AT_SCENARIO_END is on. */
  GROWTH_TIER_SHARE: { critical_failure: 0.5, failure: 0.6, near_miss: 0.7, success: 0.8, great_success: 0.9, critical_success: 1 } as Record<string, number>,
  GROWTH_ROLLS_PAST_CRIT: 1,
  /** EG5 b: what each ending pays (judged endings too: by which ending it was). EG17 a: every factor is kept between
   * ENDING_FACTOR_MIN and ENDING_FACTOR_MAX, so no ending the Weaver writes or picks can pay outside them (placeholders) */
  ENDING_FACTOR: { resolved: 1, lost: 0.75, broken_off: 0.75, left: 0.5, escaped: 0.5, interrupted: 0.5, worn_out: 0.5 } as Record<string, number>,
  ENDING_FACTOR_MIN: 0.5,
  ENDING_FACTOR_MAX: 1.25,
  /** EG10 b: a scenario that marked anything pays this many extra rolls while the character level is below GROWTH_LOW_LEVEL_BELOW */
  GROWTH_LOW_LEVEL_BONUS: 1,
  GROWTH_LOW_LEVEL_BELOW: 5,
  /** growth proposal 2 (essences; placeholders). Points = max(1, round(ESSENCE_SHARE × source skill × grade multiplier)) */
  ESSENCE_SHARE: 0.07,
  ESSENCE_GRADE_MULT: { common: 1, fine: 1.5, rare: 2.5, epic: 4, legendary: 6 } as Record<string, number>,
  /** each grade past the last row multiplies the last row's multiplier by this */
  ESSENCE_GRADE_PAST_MULT: 1.5,
  /** a beaten foe is notable (may offer) when its power is at least this share of the player's, or its template is notable or unique */
  ESSENCE_NOTABLE_SHARE: 0.75,
  /** the offer roll: margin = d100 + base − ESSENCE_ROLL_NEEDED on the tier table (base 80: offers 31%; 100: 51%) */
  ESSENCE_ROLL_NEEDED: 150,
  ESSENCE_ROLL_BASE: { foe: 80, great_success: 80, critical_success: 100 } as Record<string, number>,
  /** EG2: room for essences = ESSENCE_SLOTS_BASE + one per ESSENCE_SLOT_EVERY character levels (2 at 7, 3 at 14), no top */
  ESSENCE_SLOTS_BASE: 1,
  ESSENCE_SLOT_EVERY: 7,
  /** an offer waits this many turns (or until a new scenario starts) */
  ESSENCE_OFFER_TURNS: 10,
  /** EG3 b + EG15 b: removing a held essence (at rest) costs this many levels' worth of XP; the bar may go into debt */
  ESSENCE_REMOVE_LEVELS: 1,
  /** BG-41: lines of what happened kept per scenario for the Weaver check-in (newest kept; placeholder) */
  SCENARIO_HAPPENED_MAX: 30,
  /** CH7/SC18: a chase is lost when no pursuer has seen or heard the player for this many turns (placeholder) */
  CHASE_LOST_TURNS: 3,
  /** CH5: the chase range of a code-run NPC whose band and template give none (a CHASE_RANGES key; placeholder) */
  CHASE_RANGE_DEFAULT: 'ground',
  IMPROVISED_HIT_ADJ: -10,
  /** CO13 action slots each actor gets a turn: a movement spends a move slot first, then a main slot (two moves = a dash) */
  MOVE_SLOTS: 1,
  RANGED_MOVE_SLOTS: 1, // ZP3: move slots a ranged attack (shot or throw) costs besides the main action; a perk could lower it
  /** RD7 worn armor's slowing by weight: flat m/s off the body type's speeds, then a share off what is left (an armor item's
   * own `speed` overrides). Placeholders: no study gives speed loss directly; heavy is about a fifth, as asked */
  ARMOR_SPEED: { light: { flat: 0, pct: 0 }, medium: { flat: 0.1, pct: 0.05 }, heavy: { flat: 0.2, pct: 0.15 } } as Record<string, { flat: number; pct: number }>,
  MAIN_SLOTS: 1,
  /** CO14 the range unit: one pace in metres, the one lever every range and move scales by (about one stride) */
  PACE_M: 1,
  /** CO14 today's zone link in paces, to convert range tables written in links (placeholder) */
  LINK_PACES: 8,
  /** CO16 floor area in m² of each zone size (ZONE_SIZES); placeholders */
  ZONE_SIZE_M2: { cramped: 9, small: 25, room: 60, hall: 225, yard: 400, open: 1600, vast: 10000 } as Record<string, number>,
  /** TV3 road lengths in km (ROAD_LENGTHS): a walk of about 4.5 km an hour gives the time words their lengths */
  ROAD_LENGTH_KM: { short_walk: 0.5, half_hour: 2, hour: 4.5, half_day: 15, day: 30, two_days: 60 } as Record<string, number>,
  /** TV3 a road's width in metres: a cart track or Roman road, about 4 m (Roman viae ran about 4 to 6 m with the verges) */
  ROAD_WIDTH_M: 4,
  /** TV4 the chance in % per hour on the road that something meets you, by ROAD_DANGERS (placeholders) */
  ROAD_ENCOUNTER_PCT: { safe: 2, quiet: 4, wild: 8, dangerous: 15 } as Record<string, number>,
  /** TV2 travel paces as shares of the walking speed: a body that walks 1.4 m/s (an everyday walk) travels slow 3, normal
   * 4.5 and fast 6 km/h (D&D's 3.2 / 4.8 / 6.4 km/h, a brisk real walk about 5) */
  TRAVEL_PACE_SHARE: { slow: 0.6, normal: 0.9, fast: 1.2 } as Record<string, number>,
  /** TV8 the noticing roll's modifier by pace: slow notices more, fast less (placeholders) */
  TRAVEL_NOTICE_MOD: { slow: 10, normal: 0, fast: -10 } as Record<string, number>,
  /** TV4 a trip is walked in legs of this many game minutes; each leg on a road rolls for an encounter */
  TRAVEL_LEG_MIN: 60,
  TRAVEL_MAX_LEGS: 96, // a safety stop: four days on the road in one turn
  /** TV4/TV5 pressing on in the dark: the event roll's modifier and the encounter chance's multiplier (placeholders) */
  NIGHT_TRAVEL_EVENT_MOD: -15,
  NIGHT_ENCOUNTER_MULT: 2,
  /** TV4 how far ahead on the road an encounter stands when it starts: D&D's encounter distance in a forest, 2d6 × 10 ft
   * (about 21 m on average) */
  ENCOUNTER_M: 20,
  /** ZP1 how far apart code places people in a zone when nothing says where they stand: arm's length, the far end of
   * personal distance (Hall's proxemics, 0.45–1.2 m) */
  PLACE_GAP_M: 1,
  /** ZP2 how far into a zone a move to it walks past the doorway (a step clear of the door); BG-12 a move to a spot by a
   * wall or a way out stops this far inside it */
  ENTER_M: 1,
  /** SD7 fall damage (placeholders): flat damage by drop, landing on a leg, so tough characters power through. Each band
   * applies above its metres (real falls: little harm up to about 2 m, serious from about 6 m, often deadly from 10 m) */
  // scaling: the bands go on to about terminal speed (most of a body's falling speed is reached by about
  // 50 m), so a tower jump hurts more than a roof jump; past the last band the damage stays (placeholders)
  FALL_BANDS: [{ over: 2, damage: 15 }, { over: 5, damage: 40 }, { over: 9, damage: 80 }, { over: 15, damage: 120 }, { over: 30, damage: 160 }, { over: 50, damage: 200 }] as { over: number; damage: number }[],
  /** SD7: the Dodge roll on landing moves the fall this many bands (by tier key; a tier past either end uses the end's row) */
  FALL_LANDING_STEP: { critical_failure: 1, failure: 1, near_miss: 0, success: 0, great_success: -1, critical_success: -1 } as Record<string, number>,
  /** scaling: each tier a landing goes past Critical Success (Critical Success+, ++) moves the fall this
   * many more bands lighter, so a supernatural dodger can land a tower jump unhurt (past Critical Failure: its own row) */
  FALL_LANDING_PAST_STEP: 1,
  /** BA2: a Lockpicking roll's modifier by the lock's grade (placeholders); master or magic locks would add grades past extreme */
  LOCK_GRADE_MOD: { none: 0, minor: -10, moderate: -20, major: -35, extreme: -50 } as Record<GradeLevel, number>,
  /** BA2: seconds to pick a lock at effective skill 50 (about a minute for a common lock, placeholder), halved for every
   * PICK_HALVING_PER points above 50 and doubled for every PICK_HALVING_PER below */
  PICK_SECONDS_AT_50: 60,
  PICK_HALVING_PER: 25,
  /** scaling: picking keeps halving forever (150: about 4 s, 200: about 1 s, so supernatural fingers open locks at a touch);
   * a number stops the halving at that skill instead */
  PICK_FAST_CAP: null as number | null,
  STOREY_HEIGHT: 3, // placeholder: metres one flight of stairs climbs, when a zone's height is inferred from 'up'/'down' exit words
  /** RD6 how far each kind of thrown weapon is aimed at a man-sized target, in metres (a throw mode's reachM; perks add
   * PerkDef.throwReach metres): a spear or javelin 17.5 (the Roman pilum's effective range, 15–20 m, Wikipedia "Pilum");
   * a knife 7 (the longest standard distance in
   * European knife-throwing rules, EuroThrowers 2019); an improvised object 5 (no source: a placeholder) */
  THROW_M: { spear: 17.5, knife: 7, improvised: 5 }, // a throwing axe would be 12 (the francisca, Wikipedia "Francisca")
  /** the throw action is a combined roll: the weapon's own skill (a melee weapon's melee skill) and the ranged skill of
   * the same class, each with its own stand-ins, at these shares */
  THROW_BLEND: { weapon: 0.75, ranged: 0.25 },
  // Boon (loot V8): a reward's worth to the player. Placeholders, tune after playtests (V8c).
  BOON_COIN: 20, // coin value per Boon, unless the item sets its own boon
  BOON_QUALITY: { plain: 1, quality_1: 2, quality_2: 3, quality_3: 5, quality_4: 8 } as Record<QualityKey | 'plain', number>, // Boon multiplier by minted quality (plain: not minted)
  BOON_BUDGET: { none: 0, minor: 2, moderate: 5, major: 10, extreme: 20 } as Record<string, number>, // per plan, by gain
  // XP and levels (X1–X10). Placeholders, kept small at first (X1).
  LEVEL_XP: 100, // XP from level n to n+1 = LEVEL_XP × n
  /** no class levels higher than this; XP past a class's top level banks until a class with room is picked */
  CLASS_MAX_LEVEL: 20,
  /** a class's top level by tier: CLASS_TIER0_MAX_LEVEL + CLASS_LEVELS_PER_TIER × tier, at most CLASS_MAX_LEVEL
   * (tier 0 → 5, tier 1 → 10, tier 2 → 15, tier 3 and up → 20) */
  CLASS_TIER0_MAX_LEVEL: 5,
  CLASS_LEVELS_PER_TIER: 5,
  // Defeat XP from stats (X18–X23): per skill group, skills' training effort ranked high to low at 1, ½, ¼…, × the
  // group's XP factor; defeat XP = power × taper × DEFEAT_XP_MULT. Placeholders, tuned later (X19).
  /** XP factor levels (XP_FACTORS keys) and what each multiplies by */
  XP_FACTOR_MULT: { none: 0, quarter: 0.25, half: 0.5, three_quarters: 0.75, full: 1 } as Record<string, number>,
  /** each skill group's XP factor level in the defeat-XP rating */
  XP_GROUP_FACTOR: { [GR.melee]: 'full', [GR.ranged]: 'full', [GR.defense]: 'full', [GR.health]: 'full', [GR.notice]: 'half', [GR.stealth]: 'three_quarters', [GR.influence]: 'quarter', [GR.speed]: 'none', [GR.will]: 'full' } as Record<string, string>,
  DEFEAT_XP_MULT: 1, // X20: ×1 for now
  /** training effort scale in the rating: effort(s) = EFFORT_SCALE × ln(100 ÷ (100 − s)). 100/3 came from the old 1d5 gain (LF10); the curve is being revisited */
  EFFORT_SCALE: 100 / 3,
  /** held and worn gear adds this × its coin value to the rating, on both sides (the foe's and the player's) */
  GEAR_RATING_FACTOR: 0.25,
  /** levels in the rating, both sides: this share of the XP the actor's levels cost (LEVEL_XP × L(L−1)/2) */
  LEVEL_RATING_SHARE: 0.02,
  DEFEAT_XP_TAPER: 2, // × min(1, TAPER × foe rating ÷ player rating) (X19)
  /** D-111 Bane bonuses: an achievement earned against a race or body type gives this much skill on
   * top of the bonus of the lower level it builds on (I = +5, II = +10, III = +15), on rolls against that race or type. The best race one and the best body type one both count, stacked as one modifier type */
  BANE_SKILL_PER_LEVEL: 5,
  /** D-119: a total-defeats achievement adds this much to every attack and defense roll for each of its tiers (I = +1, II = +2, III = +3, IV = +4) */
  DEFEATS_ROLL_PER_TIER: 1,
  /** the outnumbered achievement: the most foes fighting the player at once, with no one on the player's side */
  OUTNUMBERED_FOES: 3,
  /** All-50 part numbers (src/library/allPerks.ts; placeholders) */
  FIGHTERS_FRAME_MULT: 0.9,
  DODGY_SKILL: 10,
  JUNK_ARSENAL_MULT: 1.2, // All-50 Junk Arsenal: improvised hits deal a fifth more (placeholder)
  LAST_TO_FALL_MULT: 0.75, // All-50 Last to Fall: morale losses at Wounded or worse (placeholder)
  IRON_KNUCKLES_MULT: 1.1, // All-50 Iron Knuckles: unarmed hits deal a tenth more (placeholder)
  BARE_HANDED_GUARD: 5, // All-50 Bare-Handed Guard: Dodge effective skill while holding no weapon (placeholder)
  STEADY_GUARD: 5, // All-50 Steady Guard: Parry effective skill with a medium melee weapon (placeholder)
  SHIELD_BREAKER_MULT: 2, // A3 Shield Breaker: a heavy melee blow on a shield drains its pool by this multiple of the damage (placeholder)
  IRON_RIM_MULT: 0.75, // All-50 Iron Rim (Block's part): damage the owner's shield pool takes (placeholder)
  GRIT_SHARE: 0.25, // All-50 Grit (Resolve's part): share of Endurance that augments Resolve (placeholder)
  THICK_HIDE_MULT: 0.95, // All-50 Thick Hide: health lost from each hit (placeholder)
  /** XP per reward level (REWARD_LEVELS in src/scales.ts), for achievements */
  REWARD_XP: { minus_1: 25, zero: 50, i: 100, ii: 250, iii: 1000, iv: 2000, v: 5000, vi: 10000,
    vii: 20000, viii: 40000, ix: 80000, x: 160000, xi: 320000, xii: 640000, xiii: 1280000, xiv: 2560000, xv: 5120000 } as Record<string, number>, // VII–XV placeholders
  /** QT28: XP per quest reward level (QUEST_REWARD_LEVELS), separate from achievements */
  QUEST_REWARD_XP: { zero: 50, i: 100, ii: 250, iii: 1000, iv: 2000 } as Record<string, number>,
  /** QT9: a quest's reward level from the scenario's gain grade when it is accepted (iv is kept for later story quests) */
  QUEST_GAIN_LEVEL: { none: 'zero', minor: 'zero', moderate: 'i', major: 'ii', extreme: 'iii' } as Record<string, QuestRewardLevel>,
  GAIN_MAX_QUALITY: { none: null, minor: 'quality_1', moderate: 'quality_2', major: 'quality_3', extreme: 'quality_4' } as Record<string, QualityKey | null>, // null: no minted item
  // ---- Part 2 engine ----
  DECAY_TURNS: 6, // Q2 (test 72 implies 6)
  MAX_PLANNER_CALLS: 3, // Q2 (D-18)
  /** Claude calls the viewer runs at once (unconfirmed, the spec's "a couple"); background calls keep one free for the turn's own (Q4) */
  CALL_SLOTS: 2,
  MAX_SPOKESPEOPLE: 2, // Q2
  BACKGROUND_WINDOW_MS: 8_000, // Q2 (D-39)
  DIALOGUE_WINDOW_MS: 10_000, // Q2
  WEAVER_TIMEOUT_MS: 120_000, // Q2
  NPC_BUILDS_PER_TURN: 1, // NW3: background builds NPCs waiting at unbuilt frontiers may start per turn
  GUIDED_COIN_SHARE: 0.25, // GA9: the guided agent asks before spending more than this share of the coin in one go
  AUTOPILOT_INFO_EVERY: 8, // BG-25: the autopilot looks at /stats, /inv or /quests at most once in this many moves
  AUTOPILOT_SAID_KEPT: 6, // the agent's last commentary lines it is shown, so it doesn't repeat its words
  AUTOPILOT_VOICE_WAIT_MS: 6000, // the agent's command waits up to this long for its spoken line to start, so voice and move line up
  AUTOPILOT_TIMEOUT_MS: 60_000, // a Watch-an-agent-play move that takes longer is given up and asked again, so the bar never hangs
  MAX_ROUTE_ZONES: 4, // Q2
  PLAN_CAPS: { cast: 8, zones: 8, frontiers: 4, places: 4, bands: 3, knows: 5 }, // Q2
  TEXT_CAP: 200, // Q2: free-text length cap for public text (names, looks, labels, knows)
  NOTE_CAP: 400, // V6: hidden-only notes (summary, goals, motive, Weaver note, secret facts) are trimmed to this
  SCENARIO_CAPS: { promotions: 3, minted: 2 }, // Q2
  DURATIONS: { brief: 1, short: 3, medium: 6, long: 12 } as Record<string, number>,
  RECENT_EVENTS: 8, // compact views: last few relevant events
  MEMORY_ENTRIES: 8, // PM1: an NPC's memory list holds at most this many entries (placeholder)
  EARLIER_LINES: 6, // PM6: code-made lines about events older than RECENT_EVENTS (placeholder)
  SAID_LINES: 6, // P5: an NPC's own last lines in its view, so it stops repeating itself
  STORY_PREMISE: 'A swordsman arrives at a village troubled by slimes',
  SHOW_MECHANICS: true, // master switch: false removes Show rolls everywhere
  SHOW_ROLLS_DEFAULT: false, // a new story starts with Show rolls off; the player turns it on from the play header
  /** M-33: reaching this health level or worse pulses the play screen's edge red once; from MOTION_EDGE_STEADY on the edge keeps a steady tint */
  MOTION_EDGE_FROM: 'wounded' as HealthLevelKey,
  MOTION_EDGE_STEADY: 'critical' as HealthLevelKey,
  TRAIL_ZONES: 3, // the player's last places left, shown to the parser so "go back" has somewhere to mean (placeholder)
  WEAVER_MODEL: 'claude-opus-5-5',
  WEAVER_EFFORT: 'high' as 'low' | 'medium' | 'high',
  MODEL_TIERS: { parser: 'quick', planner: 'default', responder: 'default', voice: 'default', narrator: 'complex', weaver: 'complex', autopilot: 'default' } as Record<string, 'quick' | 'default' | 'complex'>,
  STYLE: { tone: 'grounded dark fantasy with an edge: vivid and punchy, a touch of anime drama in the big moments, never over the top', // (flavor voice V5)
    length: '2 to 4 short paragraphs' },
};

export type Config = typeof DEFAULTS;
export const CONFIG: Config = structuredClone(DEFAULTS);
export function resetConfig(): void {
  Object.assign(CONFIG, structuredClone(DEFAULTS));
}

