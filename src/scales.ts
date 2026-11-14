// Ordered scales. Each scale is one table of [key, display name] rows, lowest first.
// Code and saves use only the key; a level's order is its row position; display names live only here.
// Adding or renaming a level edits only its table.

export type Scale<K extends string> = {
  /** keys, lowest first */
  keys: readonly K[];
  /** row position of a key, 0 = lowest */
  pos(k: K): number;
  /** key at a position, clamped to the ends */
  at(i: number): K;
  /** display name of a key */
  name(k: K): string;
  /** key for a key or display name in any case (text from Claude or an old save); undefined if unknown */
  keyOf(word: unknown): K | undefined;
  /** is this one of the scale's keys */
  has(x: unknown): x is K;
  /** text for prompts and errors: "a, b or c" */
  list(): string;
};

export function scale<const K extends string>(rows: readonly (readonly [K, string])[]): Scale<K> {
  const keys = rows.map((r) => r[0]);
  const names = new Map<K, string>(rows.map((r) => [r[0], r[1]]));
  const has = (x: unknown): x is K => typeof x === 'string' && names.has(x as K);
  return {
    keys,
    pos: (k) => keys.indexOf(k),
    at: (i) => keys[Math.max(0, Math.min(keys.length - 1, i))],
    name: (k) => names.get(k) ?? String(k),
    keyOf: (w) => {
      if (has(w)) return w;
      if (typeof w !== 'string') return undefined;
      const s = w.trim().toLowerCase();
      return rows.find(([k, n]) => k === s || n.toLowerCase() === s)?.[0];
    },
    has,
    list: () => rows.map((r) => r[1]).join(', ').replace(/, ([^,]*)$/, ' or $1'),
  };
}

/** check tiers, worst first (Part 1 §4) */
export const TIERS = scale([
  ['critical_failure', 'Critical Failure'], ['failure', 'Failure'], ['near_miss', 'Near Miss'],
  ['success', 'Success'], ['great_success', 'Great Success'], ['critical_success', 'Critical Success'],
]);
/** growth proposal 2.2: an essence's grade, set by its quality roll (Success common, Great Success fine, Critical Success rare,
 * one grade higher per step past it). Multipliers: CONFIG.ESSENCE_GRADE_MULT; past the last row ESSENCE_GRADE_PAST_MULT each */
export const ESSENCE_GRADES = scale([['common', 'Common'], ['fine', 'Fine'], ['rare', 'Rare'], ['epic', 'Epic'], ['legendary', 'Legendary']]);
export type EssenceGradeKey = (typeof ESSENCE_GRADES.keys)[number];
/** band tactics (V2) */
export const TACTICS = scale([['simple', 'simple'], ['competent', 'competent'], ['cunning', 'cunning']]);
/** zone light, brightest first (V1) */
export const LIGHT = scale([['bright', 'bright'], ['dim', 'dim'], ['dark', 'dark']]);
/** stance of one actor toward another, coldest first (hostile = attacks on sight; opposed = at odds, on guard, won't strike
 * first; unfriendly = dislike without a standoff: not on guard, still trades, pays no XP; friend = helps at a cost to itself;
 * loyal = takes the other's side: anyone hostile to them it treats as hostile too) */
export const STANCES = scale([['hostile', 'hostile'], ['opposed', 'opposed'], ['unfriendly', 'unfriendly'], ['neutral', 'neutral'], ['friendly', 'friendly'], ['friend', 'friend'], ['loyal', 'loyal']]);
/** how much a race thinks, least first: an achievement's first-sight reward covers races up to one of these */
export const INTELLIGENCE = scale([['unintelligent', 'Unintelligent'], ['semi', 'Semi-intelligent'], ['intelligent', 'Intelligent']]);
export type IntelligenceKey = (typeof INTELLIGENCE.keys)[number];
/** how much one actor knows of another, least first (Belief.status; decays one step at a time) */
export const AWARENESS = scale([['unaware', 'Unaware'], ['suspicious', 'Suspicious'], ['aware', 'Aware'], ['tracking', 'Tracking'], ['hunting', 'Hunting'], ['engaged', 'Engaged']]);
/** XP reward levels for achievements; XP per level is rewardXp (the REWARD_XP_CURVE equation) */
export const REWARD_LEVELS = scale([['minus_1', '−1'], ['zero', '0'], ['i', 'I'], ['ii', 'II'], ['iii', 'III'], ['iv', 'IV'], ['v', 'V'], ['vi', 'VI'],
  ['vii', 'VII'], ['viii', 'VIII'], ['ix', 'IX'], ['x', 'X'], ['xi', 'XI'], ['xii', 'XII'], ['xiii', 'XIII'], ['xiv', 'XIV'], ['xv', 'XV']]);
export type RewardLevel = (typeof REWARD_LEVELS.keys)[number];
/** QT28: the reward levels a quest may have, 0 to IV: rows of REWARD_LEVELS (keys and names from there); XP per level is
 * rewardXp, as for achievements; the level from CONFIG.QUEST_GAIN_LEVEL */
export const QUEST_REWARD_LEVELS = scale(REWARD_LEVELS.keys.slice(REWARD_LEVELS.pos('zero'), REWARD_LEVELS.pos('iv') + 1).map((k) => [k, REWARD_LEVELS.name(k)] as const));
export type QuestRewardLevel = (typeof QUEST_REWARD_LEVELS.keys)[number];
/** AT25/AT57: an action's focus, what breaks it from outside, least first: reflex (nothing, too quick), steady (a hit that
 * wounds), careful (any attack aimed at the actor), deep (also anyone coming near, AT67) */
export const FOCUS = scale([['reflex', 'Reflex'], ['steady', 'Steady'], ['careful', 'Careful'], ['deep', 'Deep']]);
export type FocusKey = (typeof FOCUS.keys)[number];
/** AT26/AT57: whether the actor may choose to stop an action: any time, never (sleep), or until a share of its progress */
export const STOPS = scale([['any', 'Any time'], ['until', 'Until a share'], ['never', 'Never']]);
export type StopKey = (typeof STOPS.keys)[number];
/** AT27: what an action gives: the whole effect at the end, in proportion, or points along the way */
export const OUTPUTS = scale([['end', 'At the end'], ['share', 'In proportion'], ['steps', 'In steps']]);
export type OutputKey = (typeof OUTPUTS.keys)[number];
/** AT6/AT28: what is left of an action broken off: nothing, the work kept for later, its share, a misfire (a Misfires row),
 * or the whole effect */
export const BREAKS = scale([['lost', 'Lost'], ['kept', 'Kept'], ['share', 'Its share'], ['misfire', 'Misfires'], ['fires', 'Fires']]);
export type BreakKey = (typeof BREAKS.keys)[number];
/** SC2: scenario scales, smallest first. Each scale's budget and space are levers in CONFIG.SCENARIO_SCALE, keyed by key;
 * a new scale is a new row here and a row there. */
export const SCENARIO_SCALES = scale([['moment', 'Moment'], ['situation', 'Situation'], ['episode', 'Episode'], ['journey', 'Journey'], ['venture', 'Venture']]);
export type ScenarioScale = (typeof SCENARIO_SCALES.keys)[number];
/** grades, none to divine (D-7; CR4, CR12): how hard a task, a challenge or a lock is, and how big a gain. The Weaver's
 * challenge and gain, barriers, gains and locks use none to WEAVER_GRADE_TOP; the rows past it are task grades only */
export const GRADE_LEVELS = scale([['none', 'None'], ['minor', 'Minor'], ['moderate', 'Moderate'], ['major', 'Major'], ['extreme', 'Extreme'],
  ['mortal_limit', 'Mortal limit'], ['beyond', 'Beyond'], ['mythic', 'Mythic'], ['divine', 'Divine']]);
export type GradeLevel = (typeof GRADE_LEVELS.keys)[number];
/** the top grade the Weaver, barriers, gains and locks use */
export const WEAVER_GRADE_TOP: GradeLevel = 'extreme';

/** what an attack did, by how far it got: nowhere, stopped by the defense (dodged, parried, blocked on a shield), then
 * reaching the body, lightest first. src/ruleset/hits.ts reads it: met = blocked or past, struck = grazed or past */
export const HIT_OUTCOMES = scale([['missed', 'Missed'], ['dodged', 'Dodged'], ['parried', 'Parried'], ['blocked', 'Blocked'], ['grazed', 'Grazed'],
  ['full_hit', 'Full hit'], ['heavy_hit', 'Heavy hit'], ['crushing_hit', 'Crushing hit']]);
export type HitOutcome = (typeof HIT_OUTCOMES.keys)[number];

/** a minted item's quality, lowest first (CS9). Its multiplier in the quality formulas is its position + 1
 * (src/ruleset/quality.ts). */
export const QUALITY_LEVELS = scale([['quality_1', 'Passable'], ['quality_2', 'Solid'], ['quality_3', 'Exceptional'], ['quality_4', 'Flawless']]);
export type QualityKey = (typeof QUALITY_LEVELS.keys)[number];

/** CH5/SC19: how far a code-run pursuer follows the player, least first: post (never leaves its own place), ground (stays on
 * the scenario's ground), near (the ground and up to CHASE_NEAR_M metres past its edge by the walking path), far (anywhere, through frontiers after the player).
 * Agent-run NPCs decide for themselves. A new range is a new row here and a branch in engine/chase.ts chaseZones. */
export const CHASE_RANGES = scale([['post', 'Post'], ['ground', 'Ground'], ['near', 'Near'], ['far', 'Far']]);
export type ChaseRange = (typeof CHASE_RANGES.keys)[number];
/** AG3: life stages, youngest first; each race lists the age in years at which each starts (RaceDef.ageStages).
 * Past the last row a + per step (AG7, ruleset/age.ts). */
export const LIFE_STAGES = scale([['stage_0', 'Child'], ['stage_1', 'Youth'], ['stage_2', 'Adult'], ['stage_3', 'Middle-aged'], ['stage_4', 'Old'], ['stage_5', 'Venerable'], ['stage_6', 'Ancient']]);
export type LifeStageKey = (typeof LIFE_STAGES.keys)[number];
/** time of day, in the order a day runs from dawn (T2); each starts at CONFIG.TIME_OF_DAY_FROM */
export const TIME_OF_DAY = scale([['dawn', 'Dawn'], ['morning', 'Morning'], ['afternoon', 'Afternoon'], ['dusk', 'Dusk'], ['evening', 'Evening'], ['night', 'Night']]);
export type TimeOfDay = (typeof TIME_OF_DAY.keys)[number];
/** body-part states, best first; ruleset/body.ts poolState names them (H12: healing reach is a key here, so perks shift it by steps) */
export const PART_STATES = scale([['healthy', 'Healthy'], ['damaged', 'Damaged'], ['crippled', 'Crippled'], ['destroyed', 'Destroyed']]);
export type PartStateKey = (typeof PART_STATES.keys)[number];
/** health levels, unhurt first; the % lost and wounds modifier of each are CONFIG.HEALTH_TRACK (keyed by these keys, in this order) */
export const HEALTH_LEVELS = scale([['unhurt', 'Unhurt'], ['bruised', 'Bruised'], ['hurt', 'Hurt'], ['injured', 'Injured'], ['wounded', 'Wounded'], ['mauled', 'Mauled'], ['critical', 'Critical'], ['incapacitated', 'Incapacitated'], ['dead', 'Dead']]);
export type HealthLevelKey = (typeof HEALTH_LEVELS.keys)[number];
/** the player's posture (ST5: not named like the Sneaking skill) */
export const POSTURES = scale([['open', 'Open'], ['stealthy', 'Stealthy']]);
/** AT67: how someone is lying, sitting or standing, for how long they take to get ready (CONFIG.READY_S) */
export const BODY_POSES = scale([['lying', 'Lying'], ['sitting', 'Sitting'], ['standing', 'Standing']]);
export type BodyPoseKey = (typeof BODY_POSES.keys)[number];
/** how loud an event is, quietest first; each level's decibels are CONFIG.NOISE_DB, its real reference the library's noiseLevels row,
 * and how well it is heard comes from perception/noise.ts (hearingOf) */
export const NOISE = scale([['silent', 'Silent'], ['faint', 'Faint'], ['hushed', 'Hushed'], ['quiet', 'Quiet'], ['murmur', 'Murmur'], ['normal', 'Normal'], ['raised', 'Raised'], ['loud', 'Loud'], ['blaring', 'Blaring'], ['deafening', 'Deafening']]);
export type NoiseKey = (typeof NOISE.keys)[number];
/** HB4: what sound loses crossing between two zones, least first; the decibels of each are CONFIG.SOUND_LOSS_DB */
export const SOUND_LOSS = scale([['open', 'Open gap'], ['window', 'Shut window'], ['door', 'Shut door'], ['wall', 'Wall']]);
export type SoundLossKey = (typeof SOUND_LOSS.keys)[number];
/** how far an event is seen, least first; reach per level is CONFIG.SIGHT_M (perception sightLevel) */
export const VISIBILITY = scale([['unseen', 'Unseen'], ['faint', 'Faint'], ['close', 'Close'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['glaring', 'Glaring']]);
export type VisibilityKey = (typeof VISIBILITY.keys)[number];
/** how closely someone at an activity is paying attention, most first (an activity's attention; read by nothing yet: D-200) */
export const ATTENTION = scale([['alert', 'alert'], ['normal', 'normal'], ['distracted', 'distracted'], ['asleep', 'asleep']]);
export type AttentionKey = (typeof ATTENTION.keys)[number];
/** worn armor weight, lightest first (AN3); noise steps per weight are CONFIG.ARMOR_NOISE_STEPS */
export const ARMOR_WEIGHTS = scale([['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']]);
export type ArmorWeightKey = (typeof ARMOR_WEIGHTS.keys)[number];
/** equipment levels (EQ8): what an item asks of its user's skill (CONFIG.EQUIP_NEED) */
export const EQUIP_LEVELS = scale([['crude', 'Crude'], ['common', 'Common'], ['fine', 'Fine'], ['superior', 'Superior'], ['masterwork', 'Masterwork']]);
export type EquipLevelKey = (typeof EQUIP_LEVELS.keys)[number];
/** zone cover (V1) */
export const COVER = scale([['none', 'none'], ['some', 'some'], ['heavy', 'heavy']]);
/** CO16 zone sizes, smallest first; the m² of each is CONFIG.ZONE_SIZE_M2 and its real or fantasy reference is the library's zoneSizes row */
export const ZONE_SIZES = scale([['cramped', 'cramped'], ['small', 'small'], ['room', 'room'], ['hall', 'hall'], ['yard', 'yard'], ['open', 'open'], ['vast', 'vast']]);
export type ZoneSizeKey = (typeof ZONE_SIZES.keys)[number];
/** TV3 how long a road is, shortest first; the km of each is CONFIG.ROAD_LENGTH_KM */
export const ROAD_LENGTHS = scale([['short_walk', 'a short walk'], ['half_hour', 'half an hour'], ['hour', "an hour's walk"], ['half_day', 'half a day'], ['day', "a day's walk"], ['two_days', 'two days']]);
export type RoadLengthKey = (typeof ROAD_LENGTHS.keys)[number];
/** TV4 how dangerous a road is, safest first; the encounter chance per hour of each is CONFIG.ROAD_ENCOUNTER_PCT */
export const ROAD_DANGERS = scale([['safe', 'safe'], ['quiet', 'quiet'], ['wild', 'wild'], ['dangerous', 'dangerous']]);
export type RoadDangerKey = (typeof ROAD_DANGERS.keys)[number];
/** TV2 travel paces, slowest first; each is a share of the walking speed (CONFIG.TRAVEL_PACE_SHARE) */
export const TRAVEL_PACES = scale([['slow', 'slow'], ['normal', 'normal'], ['fast', 'fast']]);
export type TravelPaceKey = (typeof TRAVEL_PACES.keys)[number];

/** Skill tiers: a skill's tier sets its final efficiency multiplier (CONFIG.SKILL_TIER_MULT). */
export const SKILL_TIERS = scale([['tier_0', 'Tier 0'], ['tier_1', 'Tier 1'], ['tier_2', 'Tier 2']]);
export type SkillTierKey = (typeof SKILL_TIERS.keys)[number];
/** morale levels, calmest first (MB2); bands and penalties per level are CONFIG.MORALE_TRACK */
export const MORALE_LEVELS = scale([['calm', 'Calm'], ['uneasy', 'Uneasy'], ['tense', 'Tense'], ['rattled', 'Rattled'], ['afraid', 'Afraid'], ['terrified', 'Terrified'], ['panicking', 'Panicking'], ['broken', 'Broken']]);
export type MoraleLevel = (typeof MORALE_LEVELS.keys)[number];
/** FT3/FT22 fatigue levels, freshest first; where each starts, its roll penalty and its short-line band are CONFIG.FATIGUE_TRACK */
export const FATIGUE_LEVELS = scale([['rested', 'Rested'], ['fine', 'Fine'], ['tired', 'Tired'], ['weary', 'Weary'], ['exhausted', 'Exhausted'], ['drained', 'Drained'], ['dead_on_feet', 'Dead on your feet'], ['collapsed', 'Collapsed']]);
export type FatigueLevel = (typeof FATIGUE_LEVELS.keys)[number];
/** FT24/FT25 effort tiers, least first: every Action times row names one and pays its strain (CONFIG.STRAIN_COST). A harder
 * tier (supernatural efforts above All-out) is a new row here and a cost there */
export const EFFORT = scale([['base', 'Base'], ['light', 'Light'], ['moderate', 'Moderate'], ['hard', 'Hard'], ['all_out', 'All-out']]);
export type EffortKey = (typeof EFFORT.keys)[number];
/** how much a skill group counts in a foe's defeat-XP rating, least first; the factor per level is CONFIG.XP_FACTOR_MULT */
export const XP_FACTORS = scale([['none', 'None'], ['quarter', 'Quarter'], ['half', 'Half'], ['three_quarters', 'Three quarters'], ['full', 'Full']]);
export type XpFactorKey = (typeof XP_FACTORS.keys)[number];
/** Class tiers: how strong a class is, to compare classes and to place NPC templates */
export const CLASS_TIERS = scale([['tier_0', 'Common'], ['tier_1', 'Trained'], ['tier_2', 'Seasoned'], ['tier_3', 'Renowned'], ['tier_4', 'Heroic'], ['tier_5', 'Legendary']]);
export type ClassTierKey = (typeof CLASS_TIERS.keys)[number];
/** TB11: a Threadbound item's Rank, weakest first. Adding a rank means adding a row here */
export const THREADBOUND_RANKS = scale([['rank_1', 'Rank I'], ['rank_2', 'Rank II'], ['rank_3', 'Rank III'], ['rank_4', 'Rank IV'], ['rank_5', 'Rank V'], ['rank_6', 'Rank VI']]);
export type ThreadboundRankKey = (typeof THREADBOUND_RANKS.keys)[number];
/** a skill tree's rating, weakest first: sets how many of its skills at a step earn its All-XXX (CONFIG.ALL_STEP_SKILLS) */
export const TREE_RATINGS = scale([['inferior', 'Inferior'], ['normal', 'Normal'], ['superior', 'Superior'], ['legendary', 'Legendary']]);
export type TreeRatingKey = (typeof TREE_RATINGS.keys)[number];

/** PL2, PL3, PL20: Nerve tiers, one ordered scale per Nerve line, lowest Resolve first. CONFIG.NERVE_TIER_FROM gives the
 * raw Resolve each position starts at. Lines are unordered and named by their keys. Names are placeholders (PL18). */
export const NERVE_LINES = {
  cautious: scale([['skittish', 'Skittish'], ['timid', 'Timid'], ['careful', 'Careful'], ['prudent', 'Prudent'], ['cool_headed', 'Cool-headed'], ['imperturbable', 'Unflappable']]),
  steady: scale([['jittery', 'Jittery'], ['settled', 'Settled'], ['steady', 'Steady'], ['stalwart', 'Stalwart'], ['unbreakable', 'Unbreakable'], ['adamant', 'Immovable']]),
  daring: scale([['blustering', 'Blustering'], ['brash', 'Brash'], ['spirited', 'Spirited'], ['bold', 'Bold'], ['fearless', 'Fearless'], ['dauntless', 'Death-defying']]),
} as const;
export type NerveLine = keyof typeof NERVE_LINES;
/** what each Nerve line means, given with its tier */
export const NERVE_HINTS: Record<NerveLine, string> = { cautious: 'keeps out of danger when they can', steady: 'neither seeks nor flees danger', daring: 'takes risks gladly' };
