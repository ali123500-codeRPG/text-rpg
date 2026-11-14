import type { DefenseKind, DurationId, SkillFunction, Tier } from './types';
import type { EffortKey, FatigueLevel, FragilityKey, GradeLevel, HealthLevelKey, MoraleLevel, NoiseKey, QualityKey, QuestRewardLevel } from './scales';
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
    // FL1: the Sleight group's two skills stand in for each other (a lock or filching roll asks for its function)
    [FN.lockpicking]: [{ fn: FN.filching, k: 0.3 }],
    [FN.filching]: [{ fn: FN.lockpicking, k: 0.3 }],
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
  /** SM1: the first mark on a skill in an engagement owes a roll, and so does every Nth mark after it (2: marks 1, 3, 5...).
   * Infinity: one roll per skill per engagement. */
  MARK_STACK_EVERY: 2,
  /** SG1 C: the mortal limit raw skill can train to (Part 1 §6) */
  SKILL_CAP: 100,
  /** EG16: a tagged skill's cap is SKILL_CAP plus this */
  TAG_CAP_BONUS: 25,
  /** a flawed skill's cap is SKILL_CAP minus this */
  FLAW_CAP_PENALTY: 25,
  /** SG1 C: an improvement roll's margin = d100 + (cap − raw − Burden) − this, read on the tier table (placeholder; with GROWTH_GAIN
   * below, about 1.6 points a roll at raw 50) */
  GROWTH_ROLL_NEEDED: 90,
  /** SG1 C: raw gained by the improvement roll's tier; worse tiers gain nothing (placeholders) */
  GROWTH_GAIN: { success: 2, great_success: 3, critical_success: 4 } as Partial<Record<Tier, number>>,
  /** SG1 C: extra raw per band past Critical Success (only a roll with a tier unlock for 'any' roll reaches one) */
  GROWTH_GAIN_PAST_CRIT: 1,
  /** SG2 a: natural edges (01–05, 96–100) do not move the improvement roll's tier: no skill grows from the die face
   * alone (LF4) */
  GROWTH_NATURAL_EDGES: false,
  /** SG3 a: true = a skill's own cap (125 tagged, 75 flawed) is in the roll too, so the room left counts from it;
   * false = every skill rolls against SKILL_CAP and only its stop moves */
  GROWTH_CAP_IN_ROLL: true,
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
  AIM_EASE_PCT: 10, // TM26: each aimed-hits-by-size achievement row takes this % off the aim penalty for its size (carried up the chain)
  GENERAL_MIN_PCT: 30,
  GENERAL_BIG_WEIGHT: 4,
  IMPACT_MULT: { non_essential: 0, normal: 1, essential: 1.5 } as Record<string, number>,
  ROLE_PENALTY: { damaged: -10, crippled: -20 },
  /** a part or pool is in a state while its % left is above that state's floor: Healthy >50, Damaged >0, Crippled >−100; else Destroyed */
  PART_STATE_ABOVE: { healthy: 50, damaged: 0, crippled: -100 } as Record<string, number>,
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
  // the ladder's rows run GAP_MIN..GAP_MAX; −6..−10 are placeholders (+0.5 a step). A gap past GAP_MAX uses that row; past
  // GAP_MIN each further step adds GAP_PAST_STEP, with no top (CS10)
  GAP_MIN: -10,
  GAP_MAX: 5,
  GAP_PAST_STEP: 0.5,
  GAP_LADDER: {
    dodge: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1.375, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.8, 2: 0, 3: 0, 4: 0, 5: 0 },
    block: { [-10]: 4.5, [-9]: 4, [-8]: 3.5, [-7]: 3, [-6]: 2.5, [-5]: 2, [-4]: 1.5, [-3]: 1, [-2]: 1, [-1]: 1, 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0.2, 5: 0.15 },
    // PA3 (placeholders): cuts less than Block at small gaps, stops the blow fully from +3; a failed parry punishes harder
    parry: { [-10]: 5, [-9]: 4.5, [-8]: 4, [-7]: 3.5, [-6]: 3, [-5]: 2.5, [-4]: 2, [-3]: 1.5, [-2]: 1.25, [-1]: 1.1, 0: 1, 1: 0.85, 2: 0.65, 3: 0, 4: 0, 5: 0 },
  } as Record<DefenseKind, Record<number, number>>,
  /** the gap ladder's outcome and location thresholds (Part 3, Defense), beside GAP_LADDER's multipliers */
  HIT_GAPS: {
    graze: 1, // a dodge that wins by this or more (and still takes a share of the blow) is grazed
    blockFrom: 1, // a block or parry at this gap or better is blocked ...
    shieldFrom: 0, // ... and a block with a shield from this gap, which then takes the hit
    heavy: -4, // a hit at this gap or worse is a heavy hit
    crushing: -5, // ... and at this gap or worse a crushing hit
    movesAdjacent: -2, // at this gap or worse a hit moves to the named part if it is adjacent ...
    movesAnywhere: -3, // ... and at this gap or worse to the named part anywhere
    noEssentialFrom: { dodge: 0, block: -1, parry: -1 }, // from this gap up a hit never lands on an essential part
    nonEssentialOnlyFrom: { block: 0, parry: 0 }, // from this gap up a block or parry lets it land on non-essential parts only
  } as { graze: number; blockFrom: number; shieldFrom: number; heavy: number; crushing: number; movesAdjacent: number; movesAnywhere: number;
    noEssentialFrom: Record<DefenseKind, number>; nonEssentialOnlyFrom: Record<'block' | 'parry', number> },
  DODGE_VS_MISSILE: 10,
  OUTNUMBERED_MOD: -5, // Q2 (D-76)
  UNAWARE_MOD: -10, // Q2 (D-76)
  INIT_UNAWARE: 0, // Q2: unaware actors act last
  /** AT58/AT60: reaction time when a fight starts for an actor: REACT_BASE_S seconds at an initiative total of 50, halving
   * every REACT_HALVING points above (doubling below), times the time factor; a hesitation waits it out again */
  REACT_BASE_S: 2,
  REACT_HALVING: 50,
  /** AT74: Gut Feeling rolls once every this many rounds for each hidden watcher */
  HUNCH_EVERY_ROUNDS: 20,
  /** AT74: perk marks that lasted "the next turn" (Leg Bolt's slow, Make Them Stumble, Dirt in the Eyes) last this many rounds */
  PERK_MARK_ROUNDS: 2,
  OVERWHELM_TIERS: 3, // MR4 Overwhelm: an aura roll lost by this many tiers or more can overwhelm
  OVERWHELM_MORALE_SHARE: 0.5, // ... a target whose max morale is at most this share of the owner's
  AURA_REACH_M: 8, // I3/RD1: metres an engagement aura reaches (placeholder); the aura skill sets it once RD9's formula is chosen (D-193)
  // E1/YD6/AT72: an engagement ends, and hunting and engaged drop to tracking, after ENGAGEMENT_END with no blow or closing in:
  // worked out from the Action times table (ruleset/actionTime engagementEndS: the slowest attack cycle + one round)
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
   * law, never nearer than NEAREST_M) and loses SOUND_LOSS_DB at each crossing on its way, by the least-loss route. It is
   * heard while at least HEARING_FLOOR_DB and heard clearly (who and what) from CLEAR_ABOVE_FLOOR_DB over it: ANSI/ASA S12.60
   * asks a classroom's speech to stand 15 dB over its background. */
  NEAREST_M: 1, // the nearest any sight or sound is measured: the 1 m every decibel level is given at
  CLEAR_ABOVE_FLOOR_DB: 15,
  /** D-231: one hearing floor everywhere while per-zone background noise is parked: a quiet place (40 dB, a library or a quiet
   * street at night, Québec) at the old 0.5 game share. A [Proposed] lever. */
  HEARING_FLOOR_DB: 20,
  /** HB8: a whisper to someone within WHISPER_REACH_M is said leaning in, WHISPER_LEAN_M from their ear (an estimate:
   * no measured leaning distance was found) */
  WHISPER_REACH_M: 1,
  WHISPER_LEAN_M: 0.3,
  /** HB4: decibels lost at each crossing, by SOUND_LOSS level: an open gap nothing; a shut window about 30, a shut door about
   * 30, a wall about 35 (their sound transmission class, STC) */
  SOUND_LOSS_DB: { open: 0, window: 30, door: 30, wall: 35 } as Record<string, number>,
  /** sight (perception sightLevel): how far each VISIBILITY level is made out clearly (who and what) and glimpsed
   * (something, not who), in metres, in daylight with a clear view, from real references (the library's
   * visibilityLevels rows); null = nothing to see. Sight distance is never under NEAREST_M (seeingM), so a level made
   * out only nearer than that (faint) is at most glimpsed. A dark zone caps sight at partial. */
  SIGHT_M: { unseen: null, faint: [0.5, 2], close: [6, 20], low: [15, 60], normal: [25, 200], high: [50, 500], glaring: [200, 2000] } as Record<string, [number, number] | null>,
  // ---- searching (SE20, SE21, SE24, SA8; placeholders) ----
  /** SE20: what one search covers outside a fight at the base skill: the game's room size (a tavern common room) */
  SEARCH_AREA_M2: 60,
  /** SE21 b: the search area grows in a straight line with the rolling sense's effective skill: area × skill ÷ this */
  SEARCH_AREA_SKILL_BASE: 50,
  /** SA8 b: a fight turn (6 s) reaches search area ÷ this metres (0.5 m at skill 50, 1 m at 100); searchReach adds this
   * many m² of area per metre (SE24) */
  SEARCH_M2_PER_FIGHT_M: 120,
  /** SE14 b: Look around is also a search against anyone hiding in its range, this many tiers down */
  LOOK_SEARCH_SHIFT: -1,
  /** SE25: what an item search learns against when no one did the hiding (a Weaver-hidden item, concealed gear): a
   * hidden-at tier counts as this skill at Success, and this much more for each tier step above it (less below, never under 0) */
  HIDDEN_TIER_SUCCESS_SKILL: 50,
  HIDDEN_TIER_SKILL_STEP: 25,
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
  /** PL20: past the last tier, every this much more Resolve adds a + to its name */
  NERVE_BEYOND_STEP: 50,
  /** PL2, PL3: a Nerve or trait value leans (counts) at this distance from 0 or more */
  PERSONALITY_LEAN: 20,
  /** the Ideas panel: a held value pulls toward its ideas by this many points, as a trait would */
  IDEA_VALUE_PULL: 50,
  /** the Ideas panel: an idea the character is pulled away from by this many points or more says "against your nature" */
  IDEA_AGAINST_NATURE: 50,
  /** PL9: the word before a trait, from its distance from 0: [from, word] (below the first, the trait is left out) */
  TRAIT_WORDS: [[20, 'a bit '], [40, ''], [70, 'very ']] as [number, string][],
  /** archetype gap: the six axes and Nerve count 1 each, the drive fit counts this many times */
  ARCHETYPE_VALUE_WEIGHT: 2,
  /** drive fit for a type with no values (Ordinary): the same as a type none of whose values they hold */
  ARCHETYPE_NO_VALUES_GAP: 100,
  /** how much a held value counts toward a type's drive fit by its rank (first 1, second 0.8...); past the list, the last */
  DRIVE_RANK_WEIGHT: [1, 0.8, 0.6, 0.4, 0.3, 0.2],
  /** a "but" (a trait the archetype doesn't explain) needs this many points, this gap from the archetype's target, at most BUTS_SHOWN */
  BUT_MIN: 20,
  BUT_GAP: 40,
  BUTS_SHOWN: 3,
  /** the strongest values the agent is given as drives, and how many the Weaver and the player may pick */
  DRIVES_SHOWN: 3,
  /** tensions given to the agent, in table order */
  TENSIONS_SHOWN: 2,
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
  /** the sheet's morale bar spells out the stakes (roll penalty, what Broken stops) from this level down */
  MORALE_HINT_FROM: 'terrified',
  REST_COOLDOWN_MIN: 240, // T7: game minutes between rests (placeholder)
  // ---- fatigue and stamina (FT1-FT28; src/ruleset/fatigue.ts, src/engine/fatigue.ts). All placeholders ----
  /** FT2: the stamina bar (both layers) = STAMINA_BASE + STAMINA_PER_POINT × Stamina, like HP from Endurance */
  STAMINA_BASE: 50,
  STAMINA_PER_POINT: 1,
  /** FT3/FT22: [FATIGUE_LEVELS key, from % of the long-term bar used, roll penalty (type wounds), short line's band in %
   * of the bar]; collapsed = the bar is full */
  FATIGUE_TRACK: [
    ['rested', 0, 0, 100], ['fine', 15, 0, 90], ['tired', 30, -5, 80], ['weary', 45, -10, 65], ['exhausted', 60, -15, 50],
    ['drained', 75, -20, 35], ['dead_on_feet', 90, -30, 20], ['collapsed', 100, -30, 20],
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
  /** FT5: worn armour multiplies all strain, by weight */
  STRAIN_ARMOR_MULT: { light: 1, medium: 1.5, heavy: 2 } as Record<string, number>,
  /** FT23: strain past an empty short line spills into the long-term bar at this share */
  SPILL_SHARE: 0.5,
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
  SLEEP_ARMOR_MULT: { light: 1, medium: 0.75, heavy: 0.5 } as Record<string, number>,
  /** FT9: a sleep lasts until the long-term bar is clear, within these hours, or until a named time */
  SLEEP_MIN_HOURS: 1,
  /** SH1/SH2/SH4: a 120 perk adds HIGH_PERK_SHARE × its skill's true skill to that skill (instead of +5), and HIGH_PERK_SPREAD × it
   * to every skill sharing a group (beside the +1). Placeholders */
  HIGH_PERK_SHARE: 0.05,
  HIGH_PERK_SPREAD: 0.01,
  /** Stamina perks and sleep quirks (SS1-SS14). All placeholders */
  CATNAP_SLEEP_HOURS: 1, // SS1 Catnap: a full rest clears the sleep debt this many hours of sleep would
  FORCED_MARCH_RUN_EFFORT: 'moderate' as EffortKey, // SS3 Forced March: the owner's run pays this tier instead of RUN_EFFORT
  DEEP_LUNGS_LINE: 1.5, // SS4 Deep Lungs: the owner's short line is this many times its size
  SLEEPLESS_NEED: 0.2, // SS5 Sleepless: sleepNeed multiplier (hours awake add debt this many times as fast)
  BOTTOMLESS_STRAIN: 0.5, // SS6 Bottomless: every strain cost the owner pays is × this
  SECOND_BREATH_PCT: 50, // SS8 Second Breath: once per engagement an emptied line refills to this % of its size
  OVERDRIVE_SHARE: 0.1, // SS15 Overdrive (Stamina 140): while the line is above half, every roll adds this share of Stamina (the augment equation)
  PAYOFF_SHARE: 0.05, // CN4 payoff perks: the first counted piece adds this share of the skill, each further one STACK_RATIO of the one before (placeholder)
  OVERDRIVE_STRAIN: 1, // SS15 Overdrive: strain points each of those rolls costs (with worn armour and Bottomless)
  HEAVY_SLEEPER_STEPS: 1, // SS10 Heavy Sleeper: noise levels louder than WAKE_NOISE it takes to wake the owner
  INSOMNIAC_CLEAR: 0.75, // SS11 Insomniac: sleepClear multiplier
  SHORT_SLEEPER_CLEAR: 1.33, // SS13 Short Sleeper (banked, D-300): sleepClear multiplier
  SLEEP_MAX_HOURS: 24,
  // ---- game clock (T1-T8); how long each action takes is the library's Action times table (durations) ----
  /** AT35/AT74: the round, one exchange of blows: the one lever for short durations (perk marks, per-round limits). A code
   * ID only: the game never names it, it shows seconds */
  ROUND_S: 3,
  /** AE12/AT13: the most a fight turn lasts, in seconds, and the least (a turn lasts as long as the player's order) */
  FIGHT_TURN_S: 6,
  FIGHT_TURN_MIN_S: 3,
  /** AT46: the most a turn outside a fight lasts, in seconds (as long as the player's order); longer actions, walks, rests
   * and waits run on the world clock instead (AT45) */
  EXPLORE_TURN_S: 120,
  /** AT12 (placeholder): heavy armour put on or taken off alone takes this many times as long as with help */
  ARMOR_ALONE_MULT: 2,
  // ---- the world clock (AT56, AT65 to AT68; src/engine/comingNear.ts). Placeholders from the Action Time part three page.
  // The strike distance is HOSTILE_NEAR_M (a step and a blow), the lever the page names STRIKE_M ----
  /** AT67: seconds to get ready to act from each body pose (getting up off the floor takes 2 to 3 s) */
  READY_S: { lying: 3, sitting: 2, standing: 1 } as Record<import('./scales').BodyPoseKey, number>,
  /** AT67: seconds to take in what is happening and decide; the warning time is READY_S for the pose + DECIDE_S */
  DECIDE_S: 3,
  /** AT67: someone closing faster than this many times their kind's walk is rushing in, wherever they are heading */
  RUSH_SHARE: 1.5,
  /** AT67: someone accepted stops being accepted once more than this many times their trigger distance away */
  REARM_FACTOR: 2,
  /** AT67: a stretch of time steps at most half the shortest time anyone perceived needs to trigger the check, within these */
  STEP_MIN_S: 3,
  STEP_MAX_S: 60,
  TIME_OF_DAY_FROM: { dawn: 5 * 60, morning: 7 * 60, afternoon: 12 * 60, dusk: 18 * 60, evening: 20 * 60, night: 23 * 60 } as Record<string, number>, // minute of the day each starts (placeholders)
  SKY_LIGHT: { dawn: 'dim', morning: 'bright', afternoon: 'bright', dusk: 'dim', evening: 'dark', night: 'dark' } as Record<string, string>, // T3a: outdoor light by time of day (LIGHT keys)
  // NW12–NW22 sleeping (src/engine/sleep.ts). Placeholders: WAKE_GRADE, FALL_ASLEEP_MIN, SLEEP_STEP_MIN
  WAKE_NOISE: 'loud' as import('./scales').NoiseKey, // NW18: a sound this loud or louder wakes a sleeper who hears it (a shout is loud)
  WAKE_CONTACT: ['attack'] as string[], // NW14: a blow wakes the one it is aimed at, hit or miss
  /** NW19: the difficulty of a light sleeper's hearing check against someone moving openly, by their noise (louder is easier) */
  WAKE_GRADE: { faint: 'extreme', hushed: 'major', quiet: 'moderate', murmur: 'minor', normal: 'none', raised: 'none', loud: 'none', blaring: 'none', deafening: 'none' } as Record<string, import('./scales').GradeLevel>,
  FALL_ASLEEP_MIN: 30, // NW20: an NPC woken falls asleep again by its routine no sooner than this
  NIGHT_MAX_MIN: 12 * 60, // NW22 b: a night shared out in watches lasts at most 12 hours
  SLEEP_STEP_MIN: 10, // NW12: a sleep is stepped this many minutes at a time, to stop when someone hostile arrives
  ROAD_DARK: ['dusk', 'evening', 'night'] as string[], // TV: road trips stop for the dark at these times of day
  TIME_TAGS: { dawn: ['day', 'night'], morning: ['day'], afternoon: ['day'], dusk: ['day', 'night'], evening: ['night'], night: ['night'] } as Record<string, string[]>, // T3b: routine-set time tags that fit
  REST_HEAL_PCT: 25,
  STARTING_BANDAGES: 2, // H2 (placeholder)
  CLINIC_HEAL_PCT: 100,
  REST_MORALE_PCT: 50, // MB8: rest restores this share of max morale (composure table, CP.rest)
  CLINIC_MORALE_PCT: 100, // clinic care restores this share of max morale (composure table, CP.clinic)
  // ---- Part 4 ----
  // NPC generation (NG1–NG21; placeholders). A preset names a race, role, theme and rank; skills come from the rank's anchor.
  /** NG3: each rank's anchor skill and level; AG12, AG22: training = the years of training it takes, the same for every race */
  RANK_ROWS: { rank_0: { anchor: 15, level: 1, training: 0 }, rank_1: { anchor: 30, level: 2, training: 1 }, rank_2: { anchor: 50, level: 4, training: 4 }, rank_3: { anchor: 65, level: 8, training: 8 }, rank_4: { anchor: 75, level: 12, training: 12 }, rank_5: { anchor: 100, level: 20, training: 20 }, rank_6: { anchor: 150, level: 30, training: 30 }, rank_7: { anchor: 200, level: 40, training: 40 }, rank_8: { anchor: 300, level: 60, training: 50 } } as Record<string, { anchor: number; level: number; training: number }>,
  /** NG3: past the last rank row, each step adds this */
  RANK_BEYOND_STEP: { anchor: 100, level: 20, training: 10 },
  /** NG2: a role's bands as shares of the rank's anchor */
  ROLE_BAND_SHARE: { high: 1, moderate: 0.8, low: 0.6 },
  /** NG2: one lever over every NPC's skills at once (it took over from points per level) */
  NPC_BAND_MULT: 1,
  /** NG13: the lowest rank of a combat role (fighting experience) and of a civilian role; beasts have none */
  RANK_FLOOR: { combat: 'rank_2', civilian: 'rank_1' } as Record<'combat' | 'civilian', `rank_${number}`>,
  /** NG12: traits drawn from the theme's and role's pools, by rank (rank_0 first); past the last row, +RANK_TRAITS_BEYOND per step */
  RANK_TRAITS: [0, 0, 0, 1, 1, 2, 2, 3, 3],
  RANK_TRAITS_BEYOND: 1,
  /** NG14: each personality trait of a copy moves by up to this many points, seeded by its ID */
  PERSONALITY_SPREAD: 20,
  /** NG16 b: a scenario's hostile cast power over the player's power, by challenge grade; outside the band is logged in the
   * GM view only, while playtests tune the bands */
  CAST_POWER_BANDS: { minor: [0.25, 0.75], moderate: [0.5, 1.25], major: [1, 2], extreme: [1.75, 4] } as Record<string, [number, number]>,
  /** NG15: a composed NPC's starting Resolve, control and chase range by its role's kind (presets set their own) */
  COMPOSED_NPC: {
    combat: { resolve: 50, control: 'agent', chase: 'ground' },
    civilian: { resolve: 30, control: 'code', chase: 'post' },
    beast: { resolve: 50, control: 'code', chase: 'far' },
  } as Record<'combat' | 'civilian' | 'beast', { resolve: number; control: 'agent' | 'code'; chase: import('./scales').ChaseRange }>,
  /** NG9: each skill moves by up to this share of its band value, seeded by the actor's ID */
  COPY_SPREAD: 0.1,
  /** NG8: skills every NPC has at least at this band when its body can use them: the senses. Dodge is left to roles: at Low it
   * would put the thief's essence (Dodge 2, Insight 1) on every NPC's list (fit 0.6 × 2/3 = ESSENCE_FIT_SHARE) */
  NPC_COMMON_SKILLS: { [SK.eyesight]: 'low', [SK.earshot]: 'low' } as Record<string, 'high' | 'moderate' | 'low'>,
  CREATION_POINTS: 250,
  START_LEVEL: 4, // EQ13: the player starts at level 4
  CREATION_MAX_SKILL: 60,
  // Character age (AG1–AG22; placeholders)
  YEAR_DAYS: 365, // AG2: game days in a year; age = (today − birth day) ÷ YEAR_DAYS
  AGE_PLUS_NUMBER_FROM: 4, // AG7: from this many steps past the last life stage the name reads "Ancient +4" instead of "Ancient++++"
  AGE_DECLINE_FROM: 'stage_4' as import('./scales').LifeStageKey, // AG17: decline starts at the start of Old
  AGE_DECLINE_GROUPS: [GR.melee, GR.ranged, GR.defense, GR.health, GR.stealth, GR.sleight, GR.notice] as string[], // AG19: body skills and the senses (Sleight: FL1, fingers)
  CREATION_AGE_DEFAULT: 20, // AG15: the creation picker's default (a start may set its own, ClassDef.creation.age)
  NPC_AGE_STAGES: ['stage_2', 'stage_3'] as import('./scales').LifeStageKey[], // AG13: the stages an NPC is drawn from when its template names none
  /** AG23: each talent row's multiplier on a rank's training years; past the last row each step multiplies by TALENT_BEYOND_MULT */
  TALENT_MULT: { talent_0: 3, talent_1: 2, talent_2: 1, talent_3: 0.75, talent_4: 0.5 } as Record<string, number>,
  TALENT_BEYOND_MULT: 0.5,
  NPC_TALENT_DEFAULT: 'talent_2' as import('./scales').TalentKey, // AG24, AG25: Able, a real professional's pace, when neither the preset nor its theme names one
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
  // TF13–TF16: an offer to stand down in a fight (engine/offer.ts); all placeholders
  OFFER_WIN_TIERS: 3, // TF14: the win in tiers that convinces a code-run foe
  OFFER_WIN_TIERS_SHAKEN: 2, // TF14: the win that convinces it once it is hurt (OFFER_EASIER_HEALTH) or uneasy (OFFER_EASIER_MORALE)
  OFFER_YIELD_WIN_TIERS: 4, // TF19 (placeholder): the win that talks a foe into surrendering
  OFFER_YIELD_WIN_TIERS_SHAKEN: 3, // TF19 (placeholder): the same once it is hurt or uneasy
  OFFER_YIELD_EASIER: 1, // TF19 (placeholder): tiers less for each of: it is Broken, a part of it is Crippled or worse
  OFFER_EASIER_HEALTH: 'hurt' as HealthLevelKey,
  OFFER_EASIER_MORALE: 'uneasy' as MoraleLevel,
  OFFER_OPEN_TURNS: 2, // TF15: turns an AI-run listener (or the player) has to answer an offer; no answer is no
  OFFER_BRIBE_PRICE: 5, // TF10: coin per character level that makes a bribe neither help nor hurt the Barter roll
  OFFER_BRIBE_MOD: 10, // TF10: modifier on the briber's roll per doubling of the coin over that price (as much less per halving)
  /** NT3: each earlier try of the same speech kind at the same listener this engagement, on the speaker's roll */
  REPEAT_TRY: 15,
  HARD_BARGAIN_BUY: 0.9,
  HARD_BARGAIN_SELL: 1.1,
  SELL_SHARE: 0.5, // SL1: a Trader pays this share of an item's value (rounded down, at least 1)
  TRADER_PURSE: 50, // SL3: coin every Trader carries when the Weaver places it
  QUALITY_PRICE_FACTOR: 2, // SL8: a minted item's value is its base value × this × its quality (1–4)
  /** SL12 b / SL14: the coin each benefit number is worth; an item's value is its benefits summed (src/ruleset/value.ts).
   * skillPoint: per point of skill bonus (a roll bonus counts as the skill points that move a roll as much);
   * reachM: per metre of reach (its best attack mode; ZR7: 5 coin per 8 m, the old link rate, placeholder); armorStop: per point of damage stopped, per part covered;
   * armorCut: per percent of damage cut by the armor multiplier, per part covered; poolPoint: per point of a shield or armor pool */
  ITEM_VALUE: { skillPoint: 1, reachM: 0.625, armorStop: 2, armorCut: 0.1, poolPoint: 0.25 },
  ORDER_NOISE: 'normal' as NoiseKey, // RD2: an order is called out in a normal voice; the seller must hear it clearly (trade hearsOrder)
  WARES_CAP: 8, // goods lines plus services per seller
  // BG-95: words skipped when finding the short form of a name said aloud ("Wenna" for Old Wenna)
  NAME_TITLE_WORDS: ['old', 'young', 'little', 'big', 'mother', 'father', 'master', 'mistress', 'sir', 'lady', 'lord', 'brother', 'sister', 'uncle', 'aunt', 'granny', 'goodwife', 'goodman'],
  // PY9: coin is one unit in the game; narration names it in these coins, largest first
  COIN_NAMES: [['gold', 100], ['silver', 10], ['copper', 1]] as [string, number][],
  TURN_RECORDS_KEPT: 20, // N, Q2
  /** the GM view's pop-up for one person: how many of their last agent calls it shows (kept turn records only) */
  GM_AGENT_CALLS_SHOWN: 5,
  BACKUP_EVERY: 10, // Q2
  BACKUPS_KEPT: 3, // Q2
  TURN_ENDS_KEPT: 500, // AT15/AT43: turn end times kept for timers (more than the longest timer needs at the shortest turn)
  HISTORY_CHUNK_TURNS: 20, // Q18: story text saved in documents of this many turns each
  LOCK_LEASE_MS: 60_000, // Q2
  SCHEMA_VERSION: 8, // v2: tiers stored as IDs; v3: every ordered scale stored by key (src/scales.ts); v4: humanoids have two legs; v5: hostile split from opposed; v6: memory notes become memory lists (PM1); v7: event noise and visibility stored by key; v8: held items in 'grip:' slots
  // ---- Part 5 ----
  ACCESSORY_SLOTS: 3,
  /** PO1: pockets everyone has outside the pack, each holding one item (a stack counts as one) no bulkier than
   * POCKET_MAX_BULK (hand-sized: a purse, a ring, a knife, a draught); worn gear adds more (ItemDef.pockets). Placeholders */
  POCKET_SLOTS: 4,
  /** GD3: a code-run guard asks someone it suspects to open their locked container once every this many turns (placeholder) */
  SUSPECT_ASK_TURNS: 3,
  POCKET_MAX_BULK: 1,
  /** armor multiplier by weight; the damage it stops comes from ARMOR_FACTOR × need (QE4) */
  ARMOR_MULTIPLIER: { light: 0.8, medium: 0.65, heavy: 0.55 } as Record<string, number>,
  /** EQ9: true skill each equipment level needs, Masterwork ending at 100 (even steps, placeholders) */
  EQUIP_NEED: { crude: 0, common: 25, fine: 50, superior: 75, masterwork: 100 } as Record<string, number>,
  /** EQ12 c: every roll with an item you fall short on is one outcome step worse per this many points short (or part of it) */
  EQUIP_SHORT_STEP: 10,
  ARMOR_DODGE: { light: -5, medium: -10, heavy: -20 } as Record<string, number>,
  // AN1–AN4 (values are placeholders): worn armor makes body-moving events this many NOISE steps louder, per
  // ARMOR_WEIGHTS key. Moving stealthily doesn't cancel it. Quiet Mail (AN5) takes one step off.
  ARMOR_NOISE_STEPS: { light: 0, medium: 1, heavy: 2 } as Record<string, number>,
  QUALITY_TABLE: {
    tool: { quality_1: 5, quality_2: 10, quality_3: 15, quality_4: 20 } as Record<QualityKey, number>,
  },
  /** EQ11: a minted item of this quality or better is one equip level above its base */
  QUALITY_LEVEL_UP_FROM: 'quality_3' as QualityKey,
  STALL_TURNS: 8, // placeholder (P7c): quiet turns with no beat left before a new scenario
  /** SC2/AT83/AT84 levers per scenario scale (placeholders), keyed by SCENARIO_SCALES key: the budget in game minutes (fights
   * count like any other time; a long action uses it by its real length) and how many places a plan of that scale may hold
   * (code raises the scale to fit). A place is one location the Weaver builds (a tavern, a farmstead, a stretch of road) */
  SCENARIO_SCALE: {
    moment: { budgetMin: 12, places: 1 },
    situation: { budgetMin: 40, places: 2 },
    episode: { budgetMin: 2 * 60, places: 4 },
    journey: { budgetMin: 3 * 24 * 60, places: 8 },
    venture: { budgetMin: 7 * 24 * 60, places: Infinity },
  } as Record<string, { budgetMin: number; places: number }>,
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
  /** BF4/AT34 (placeholder): game seconds an NPC that led someone somewhere (head_to with lead) waits there for them before going back to its routine */
  LEAD_WAIT_S: 90,
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
  /** a beaten foe is notable (may offer) when its power is at least this share of the player's, or its template is notable or rolled */
  ESSENCE_NOTABLE_SHARE: 0.75,
  /** EN1 a: an essence row is on a template's list when the template's weighted average in the row's skills (raw × tier) is
   * at least this share of its best skill [placeholder] */
  ESSENCE_FIT_SHARE: 0.4,
  /** an essence's appearance roll: one appears when d100 ≤ this % (by source: a notable foe, any other foe (mob), or the
   * ending's tier). D-274: a notable foe always has one and a mob 5%, so for a foe only the quality roll fails. Placeholders */
  ESSENCE_APPEAR_CHANCE: { foe: 100, mob: 5, great_success: 60, critical_success: 70 } as Record<string, number>,
  /** an appeared essence's quality roll: margin = d100 + base − ESSENCE_ROLL_NEEDED on the tier table; Near Miss or worse,
   * it fades (base 80: it holds 51%; 100: 71%) */
  ESSENCE_ROLL_NEEDED: 130,
  ESSENCE_ROLL_BASE: { foe: 80, great_success: 80, critical_success: 100 } as Record<string, number>,
  /** HF18, HF29 a: a beaten echo always offers an essence (no appearance roll); its quality roll goes this many tiers up,
   * and a result below Success still gives ECHO_ESSENCE_FLOOR */
  ECHO_ESSENCE_TIERS: 2,
  ECHO_ESSENCE_FLOOR: 'common' as import('./scales').EssenceGradeKey,
  /** WP6 a: when a world is carried on, each foe who downed its last character (standing, hostile, in that place) takes
   * at most this many of the body's things, the most valuable first; coin goes whole to the first and isn't counted. Placeholder */
  LOOT_TAKE_MAX: 6,
  /** EG2: room for essences = ESSENCE_SLOTS_BASE + one per ESSENCE_SLOT_EVERY character levels (2 at 7, 3 at 14), no top */
  ESSENCE_SLOTS_BASE: 1,
  ESSENCE_SLOT_EVERY: 7,
  /** AT75: an offer waits this many rounds of game time (ROUND_S each: 10 min), or until a new scenario starts */
  ESSENCE_OFFER_ROUNDS: 200,
  /** ES5 a: an essence's coin value = its points × ITEM_VALUE.skillPoint × this (its points are permanent true skill, gear's
   * only last while worn; placeholder) */
  ESSENCE_VALUE_MULT: 10,
  /** EG3 b + EG15 b: removing a held essence (at rest) costs this many levels' worth of XP; the bar may go into debt */
  ESSENCE_REMOVE_LEVELS: 1,
  /** BG-41: lines of what happened kept per scenario for the Weaver check-in (newest kept; placeholder) */
  SCENARIO_HAPPENED_MAX: 30,
  /** CH7/SC18/AT31: a chase is lost when no pursuer has seen or heard the player for this many game seconds (placeholder) */
  CHASE_LOST_S: 60,
  /** CH5: the chase range of a code-run NPC whose band and template give none (a CHASE_RANGES key; placeholder) */
  CHASE_RANGE_DEFAULT: 'ground',
  /** ZR12: how far past the edge of the scenario's ground, by the walking path, a pursuer with chase range near follows the
   * player before it turns back (placeholder: about a village street or two; a game number, not a real-world reference) */
  CHASE_NEAR_M: 200,
  IMPROVISED_HIT_ADJ: -10,
  /** RD7 worn armor's slowing by weight: flat m/s off the body type's speeds, then a share off what is left (an armor item's
   * own `speed` overrides). Placeholders: no study gives speed loss directly; heavy is about a fifth, as asked */
  ARMOR_SPEED: { light: { flat: 0, pct: 0 }, medium: { flat: 0.1, pct: 0.05 }, heavy: { flat: 0.2, pct: 0.15 } } as Record<string, { flat: number; pct: number }>,
  /** CO14 the range unit: one pace in metres, the one lever every range and move scales by (about one stride) */
  PACE_M: 1,
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
  CATCH_UP_PACE: 'normal' as import('./scales').TravelPaceKey, // NW11: the pace NPCs keep while a turn's time moves them on
  LONG_TURN_LINES: 5, // BF2e4: a long turn's summary names at most this many people; the rest are "others came and went"
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
  /** BF35 following someone: the distance kept when none is said, sneaking or not (real metres: a tail stays back, a
   * companion keeps close), and at range how much of the weapon's reach is used (a little margin inside it) */
  FOLLOW_SNEAK_M: 5,
  FOLLOW_M: 2,
  FOLLOW_RANGE_SHARE: 0.8,
  /** BF34: an NPC no agent answered for takes a thing held out to it from anyone it is at least this toward (a STANCES key) */
  TAKE_FROM_STANCE: 'neutral',
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
  /** BK1/BK2: the best break roll that still breaks an item inside the container, by its fragility (placeholders). One roll
   * checks everything inside; a tier past Critical Failure is that tier with beyond −1, −2 (Critical Failure−, −−), which a
   * roll reaches only once an achievement unlocks it. null: never breaks. */
  FRAGILITY_BREAKS_AT: {
    fragile: { tier: 'near_miss' }, delicate: { tier: 'failure' }, sturdy: { tier: 'critical_failure' },
    tough: { tier: 'critical_failure', beyond: -1 }, solid: { tier: 'critical_failure', beyond: -2 }, unbreakable: null,
  } as Record<FragilityKey, { tier: Tier; beyond?: number } | null>,
  /** BK1 (with the extra tier between armor and weapons): an item's fragility when its row sets none, by kind (placeholders) */
  FRAGILITY_BY_KIND: { weapon: 'solid', armor: 'sturdy', shield: 'sturdy', accessory: 'delicate', tool: 'tough', consumable: 'fragile', misc: 'sturdy' } as Record<string, FragilityKey>,
  /** BK3: a broken item is worth this share of what it was worth whole (scrap; placeholder) */
  BROKEN_VALUE_SHARE: 0.1,
  /** BA2: picking a lock (the Action times pick_lock row, about a minute for a common lock at effective skill 50) is halved
   * for every PICK_HALVING_PER points above 50 and doubled for every PICK_HALVING_PER below */
  PICK_HALVING_PER: 25,
  /** scaling: picking keeps halving forever (150: about 4 s, 200: about 1 s, so supernatural fingers open locks at a touch);
   * a number stops the halving at that skill instead */
  PICK_FAST_CAP: null as number | null,
  // ---- steadying yourself (SY1; src/engine/steady.ts; placeholders) ----
  /** % of max morale a steady roll wins back (+) or loses (−) by tier; past Critical Success each step adds STEADY_PAST_PCT, past
   * Critical Failure each step takes it away */
  STEADY_PCT: { critical_failure: -10, failure: -5, near_miss: 5, success: 10, great_success: 15, critical_success: 20 } as Record<string, number>,
  STEADY_PAST_PCT: 5,
  /** seconds of game time before the same actor may steady itself again (5 fight turns) */
  STEADY_COOLDOWN_S: 30,
  /** Mentally steady (Great Success or better): the next morale loss × this */
  STEADY_BUFF_MULT: 0.5,
  // ---- filching (FL1–FL7, TN1–TN4; src/engine/filch.ts; placeholders) ----
  /** TN3 (open, round 3 TN3b): how visible a filch is, one row for every filch; Close is made out clearly within 6 m */
  FILCH_VISIBILITY: 'close' as import('./scales').VisibilityKey,
  /** TN1: the sound of a filch at Near Miss or better; each tier the roll falls below Near Miss makes it one level louder */
  FILCH_NOISE: 'hushed' as import('./scales').NoiseKey,
  /** TN4: added to a watcher's sight and hearing rolls by how closely they watch (their activity's attention; talking with
   * the filcher is alert) */
  FILCH_ATTENTION: { alert: 10, normal: 0, distracted: -10, asleep: 0 } as Record<import('./scales').AttentionKey, number>,
  /** TN4: added to a watcher's rolls by the item's size (its bulk: 0 pocket-sized, 1 hand-sized, 2 arm-sized, 3 bigger);
   * the penalty grows faster than the size, and sizes above FILCH_MAX_BULK can't be filched (a perk can open them) */
  FILCH_SIZE: [0, 5, 15, 30] as number[],
  FILCH_MAX_BULK: 2,
  /** FL2: the share of a purse's coin one try takes (at least 1) */
  FILCH_PURSE_SHARE: 0.25,
  /** FL5: stance steps colder when caught: the owner, and every other watcher who caught it */
  FILCH_CAUGHT_OWNER_STEPS: 2,
  FILCH_CAUGHT_WITNESS_STEPS: 1,
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
  PERK_POINT_EVERY: 2, // Part 1 §5: a perk point at every character level that is a multiple of this (every even level)
  /** no class levels higher than this; XP past a class's top level banks until a class with room is picked */
  CLASS_MAX_LEVEL: 20,
  /** CS11: a ladder perk milestone every this many points of true skill, and an All step every ALL_STEP_EVERY, with no top */
  PERK_MILESTONE_EVERY: 20,
  ALL_STEP_EVERY: 50,
  /** the perk page's rails always reach this far (milestones to 140, All steps to 150); a higher skill stretches them */
  PERK_RAILS_TO: 150,
  /** a class's top level by tier: CLASS_TIER0_MAX_LEVEL + CLASS_LEVELS_PER_TIER × tier, at most CLASS_MAX_LEVEL
   * (tier 0 → 5, tier 1 → 10, tier 2 → 15, tier 3 and up → 20) */
  CLASS_TIER0_MAX_LEVEL: 5,
  CLASS_LEVELS_PER_TIER: 5,
  // Defeat XP from stats (X18–X23): per skill group, skills' worth ranked high to low at 1, ½, ¼…, × the
  // group's XP factor; defeat XP = power × taper × DEFEAT_XP_MULT. Placeholders, tuned later (X19).
  /** XP factor levels (XP_FACTORS keys) and what each multiplies by */
  XP_FACTOR_MULT: { none: 0, quarter: 0.25, half: 0.5, three_quarters: 0.75, full: 1 } as Record<string, number>,
  /** each skill group's XP factor level in the defeat-XP rating */
  XP_GROUP_FACTOR: { [GR.melee]: 'full', [GR.ranged]: 'full', [GR.defense]: 'full', [GR.health]: 'full', [GR.notice]: 'half', [GR.stealth]: 'three_quarters', [GR.sleight]: 'three_quarters', [GR.influence]: 'quarter', [GR.speed]: 'none', [GR.will]: 'full', [GR.stamina]: 'quarter' } as Record<string, string>,
  DEFEAT_XP_MULT: 1, // X20: ×1 for now
  /** a skill's worth in the rating (LF15): SKILL_RATING_AT_50 × (s ÷ 50)^SKILL_RATING_POWER, s = true skill × tier; no cap */
  SKILL_RATING_AT_50: 23.1,
  SKILL_RATING_POWER: 2,
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
  AUGMENT_TRADE_SHARE: 0.5, // D-276 trade augment: share of the giving skill's true skill moved to the receiving skill (placeholder)
  AUGMENT_PERCENT_RATE: 0.2, // D-276 percentage augment: receiving true skill × this × giving true skill ÷ 100 (placeholder)
  GRIT_SHARE: 0.25, // All-50 Grit (Resolve's part): share of Endurance that augments Resolve (placeholder)
  MISDIRECTION_SHARE: 0.25, // All-50 Misdirection (Vanishing's part): share of Lying that augments Vanishing (placeholder)
  THICK_HIDE_MULT: 0.95, // All-50 Thick Hide: health lost from each hit (placeholder)
  /** XP per reward level (REWARD_LEVELS in src/scales.ts), one equation for achievements and quests with no top:
   * XP = base × ((p + shift) ÷ div)^power, p = the level's place (0 = level 0, I = 1, −1 = −1); read through rewardXp */
  REWARD_XP_CURVE: { base: 50, shift: 2, div: 2, power: 3 },
  /** QT9: a quest's reward level from the scenario's gain grade when it is accepted (iv is kept for later story quests) */
  QUEST_GAIN_LEVEL: { none: 'zero', minor: 'zero', moderate: 'i', major: 'ii', extreme: 'iii' } as Record<string, QuestRewardLevel>,
  GAIN_MAX_QUALITY: { none: null, minor: 'quality_1', moderate: 'quality_2', major: 'quality_3', extreme: 'quality_4' } as Record<string, QualityKey | null>, // null: no minted item
  // ---- Part 2 engine ----
  LIE_PLAIN_GAP: 2, // BF8: a lie seen through by this many tiers or more is plainly a lie; a narrower win gives the hint
  ERRAND_TURNS: 3, // BG-180: after an NPC answers someone with a deed under way, it gets Planner calls this many turns (a hold ends it)
  AGENT_STAY_S: 180, // BF11/AT33: a place an NPC's own agent moved it to holds this many game seconds, unless its agent decides again
  /** AT73/AT80/AT85: with no new sight or sound, a belief steps down from tracking after DECAY_TRACKING_S game seconds (a hunter
   * on a trail keeps at it longer), from aware after DECAY_AWARE_S, and from suspicious to unaware after DECAY_SUSPICIOUS_S;
   * an alarm stands down after DECAY_AWARE_S with no new alarm */
  DECAY_TRACKING_S: 600,
  DECAY_AWARE_S: 120,
  DECAY_SUSPICIOUS_S: 900,
  MAX_PLANNER_CALLS: 3, // Q2 (D-18)
  UNIQUE_THINKS_PER_TURN: 1, // UG8: goal holders' thinks per turn, after fight calls, nearest the player first (placeholder)
  GOALS_HELD: 3, // UG5: goals one actor holds at most (placeholder)
  STEPS_QUEUED: 3, // UG16: steps a think may queue (placeholder)
  STEP_MAX_DAYS: 3, // UG17: a step with no end given stops after this many days (placeholder)
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
  RPG_VOICE_ON: false, // the RPG Voice connector in the agent bar's Speaker list; parked, Claude's voices only for now
  AUTOPILOT_VOICE_WAIT_MS: 6000, // the agent's command waits up to this long for its spoken line to start, so voice and move line up
  AUTOPILOT_TIMEOUT_MS: 60_000, // a Watch-an-agent-play move that takes longer is given up and asked again, so the bar never hangs
  MAX_ROUTE_ZONES: 4, // Q2
  PLAN_CAPS: { cast: 8, zones: 8, frontiers: 4, places: 4, bands: 3, knows: 5 }, // Q2
  TEXT_CAP: 200, // Q2: free-text length cap for public text (names, looks, labels, knows)
  WORLD_TITLE_CAP: 60, // WP5: the most characters a world's title keeps
  NAME_CAP: 40, // the most characters the creation screen takes for the character's name
  NOTE_CAP: 400, // V6: hidden-only notes (summary, goals, motive, Weaver note, secret facts) are trimmed to this
  SCENARIO_CAPS: { promotions: 3, minted: 2 }, // Q2
  DURATIONS: { brief: 5, short: 30, medium: 120, long: 360 } as Record<DurationId, number>, // NW10: game minutes a routine step lasts (placeholders)
  RECENT_EVENTS: 8, // compact views: last few relevant events
  HEADLINES_PER_PLACE: 3, // CS7: the Weaver sees this many top headlines of each ancestor place (placeholder)
  MEMORY_ENTRIES: 8, // PM1: an NPC's memory list holds at most this many entries (placeholder)
  EARLIER_LINES: 6, // PM6: code-made lines about events older than RECENT_EVENTS (placeholder)
  SAID_LINES: 6, // P5: an NPC's own last lines in its view, so it stops repeating itself
  STORY_PREMISE: 'A swordsman arrives at a village troubled by slimes',
  STORY_START_PLACE: 'tavern', // First build: a new story starts in the village tavern (its place id)
  SHOW_MECHANICS: true, // master switch: false removes Show rolls everywhere
  SHOW_ROLLS_DEFAULT: false, // a new story starts with Show rolls off; the player turns it on from the play header
  /** M-33: reaching this health level or worse pulses the play screen's edge red once; from MOTION_EDGE_STEADY on the edge keeps a steady tint */
  MOTION_EDGE_FROM: 'wounded' as HealthLevelKey,
  MOTION_EDGE_STEADY: 'critical' as HealthLevelKey,
  /** MW1: the player's morale reaching this level or worse pulses the edge violet once; from MOTION_NERVE_STEADY on it keeps a
   * steady violet tint (Broken included). Where the red health edge shows too, the red one wins (placeholders) */
  MOTION_NERVE_FROM: 'terrified' as MoraleLevel,
  MOTION_NERVE_STEADY: 'panicking' as MoraleLevel,
  TRAIL_ZONES: 3, // the player's last places left, shown to the parser so "go back" has somewhere to mean (placeholder)
  /** agents that name a model and effort; the others run on their MODEL_TIERS tier, which is also the fallback when the
   * named model can't answer. Narrator on Fable 5.2 low: won 15 of 16 blind judgements against the complex tier in playtests */
  AGENT_MODELS: {
    weaver: { model: 'claude-opus-5-5', effort: 'high' },
    narrator: { model: 'claude-fable-5-2', effort: 'low' },
    // Opus 5.5 low beat the default tier 48 of 60 in blind judging: fewer unmarked lies, repeats and format slips
    responder: { model: 'claude-opus-5-5', effort: 'low' },
    voice: { model: 'claude-opus-5-5', effort: 'low' },
    planner: { model: 'claude-opus-5-5', effort: 'low' },
    // Sonnet 5.5 at its own effort ranked well above the quick tier (Haiku) in blind judging, and answered faster
    parser: { model: 'claude-sonnet-5-5' },
  } as Record<string, { model: string; effort?: 'low' | 'medium' | 'high' }>,
  MODEL_TIERS: { parser: 'quick', planner: 'default', responder: 'default', voice: 'default', narrator: 'complex', weaver: 'complex', autopilot: 'default' } as Record<string, 'quick' | 'default' | 'complex'>,
  STYLE: { tone: 'grounded dark fantasy with an edge: vivid and punchy, a touch of anime drama in the big moments, never over the top', // (flavor voice V5)
    length: '2 to 4 short paragraphs' },
};

export type Config = typeof DEFAULTS;
export const CONFIG: Config = structuredClone(DEFAULTS);
/** a new story's settings (difficulty is not a setting: it comes from who is there and the event roll, CS10) */
export const defaultSettings = (): { showMechanics: boolean; tone: string } => ({ showMechanics: CONFIG.SHOW_ROLLS_DEFAULT, tone: CONFIG.STYLE.tone });
export function resetConfig(): void {
  Object.assign(CONFIG, structuredClone(DEFAULTS));
}

