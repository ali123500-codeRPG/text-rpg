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

/** check tiers, worst first (Part 1 §4); renamed */
export const TIERS = scale([
  ['critical_failure', 'Critical Failure'], ['failure', 'Failure'], ['near_miss', 'Near Miss'],
  ['success', 'Success'], ['great_success', 'Great Success'], ['critical_success', 'Critical Success'],
]);
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
export const AWARENESS = scale([['unaware', 'Unaware'], ['suspicious', 'Suspicious'], ['aware', 'Aware'], ['tracking', 'Tracking']]);
/** XP reward levels for achievements; XP per level is CONFIG.REWARD_XP */
export const REWARD_LEVELS = scale([['zero', '0'], ['i', 'I'], ['ii', 'II'], ['iii', 'III'], ['iv', 'IV']]);
export type RewardLevel = (typeof REWARD_LEVELS.keys)[number];
/** QT28: quests' own reward levels; XP per level is CONFIG.QUEST_REWARD_XP, the level from CONFIG.QUEST_GAIN_LEVEL */
export const QUEST_REWARD_LEVELS = scale([['zero', '0'], ['i', 'I'], ['ii', 'II'], ['iii', 'III'], ['iv', 'IV']]);
export type QuestRewardLevel = (typeof QUEST_REWARD_LEVELS.keys)[number];
/** time of day, in the order a day runs from dawn (T2); each starts at CONFIG.TIME_OF_DAY_FROM */
export const TIME_OF_DAY = scale([['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']]);
export type TimeOfDay = (typeof TIME_OF_DAY.keys)[number];
/** body-part states, best first; ruleset/body.ts poolState names them (H12: healing reach is a key here, so perks shift it by steps) */
export const PART_STATES = scale([['healthy', 'Healthy'], ['damaged', 'Damaged'], ['crippled', 'Crippled'], ['destroyed', 'Destroyed']]);
export type PartStateKey = (typeof PART_STATES.keys)[number];
/** the player's posture (ST5: not named like the Sneaking skill) */
export const POSTURES = scale([['open', 'Open'], ['stealthy', 'Stealthy']]);
/** how far an event is heard, quietest first; reach per level is CONFIG.NOISE_REACH */
export const NOISE = scale([['silent', 'Silent'], ['faint', 'Faint'], ['hushed', 'Hushed'], ['quiet', 'Quiet'], ['normal', 'Normal'], ['loud', 'Loud'], ['deafening', 'Deafening']]);
export type NoiseKey = (typeof NOISE.keys)[number];
/** how far an event is seen, least first; reach per level is CONFIG.SIGHT_REACH */
export const VISIBILITY = scale([['unseen', 'Unseen'], ['faint', 'Faint'], ['close', 'Close'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['glaring', 'Glaring']]);
export type VisibilityKey = (typeof VISIBILITY.keys)[number];
/** worn armor weight, lightest first (AN3); noise steps per weight are CONFIG.ARMOR_NOISE_STEPS */
export const ARMOR_WEIGHTS = scale([['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']]);
export type ArmorWeightKey = (typeof ARMOR_WEIGHTS.keys)[number];
/** equipment levels (EQ8): what an item asks of its user's skill (CONFIG.EQUIP_NEED) */
export const EQUIP_LEVELS = scale([['crude', 'Crude'], ['common', 'Common'], ['fine', 'Fine'], ['superior', 'Superior'], ['masterwork', 'Masterwork']]);
export type EquipLevelKey = (typeof EQUIP_LEVELS.keys)[number];
/** zone cover (V1) */
export const COVER = scale([['none', 'none'], ['some', 'some'], ['heavy', 'heavy']]);

/** Skill tiers: a skill's tier sets its final efficiency multiplier (CONFIG.SKILL_TIER_MULT). */
export const SKILL_TIERS = scale([['tier_0', 'Tier 0'], ['tier_1', 'Tier 1'], ['tier_2', 'Tier 2']]);
export type SkillTierKey = (typeof SKILL_TIERS.keys)[number];
/** Class tiers: how strong a class is, to compare classes and to place NPC templates */
export const CLASS_TIERS = scale([['tier_0', 'Tier 0'], ['tier_1', 'Tier 1'], ['tier_2', 'Tier 2'], ['tier_3', 'Tier 3'], ['tier_4', 'Tier 4'], ['tier_5', 'Tier 5']]);
export type ClassTierKey = (typeof CLASS_TIERS.keys)[number];
