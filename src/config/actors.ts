// CONFIG defaults: Part 4: NPC generation, age, trade and talk. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { GrandeurKey, HealthLevelKey, MoraleLevel, NoiseKey } from '../scales';
import { GR } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { PAST_100, PAST_100_STEP } from './past100';

export const ACTORS = {
  // ---- Part 4 ----
  // NPC generation (NG1–NG21; placeholders). A preset names a race, role, theme and rank; skills come from the rank's anchor.
  /** NG3: each rank's anchor skill and level; AG12, AG22: training = the years of training it takes, in human years (AB7: scaled by race, TRAINING_ADULT_AGE).
   * NR44: Trained 8, Veteran 12, Elite 15; Paragon 20 is where a simulated fighter in typical play reached it. Past Paragon two
   * levels per 5 skill points, twice the Elite-to-Paragon rate, as raw training stops at 100 (Beyond 40, Mythic 60, Transcendent 100,
   * Divine 140, +40 a step past it). An NPC's level is this table read backwards on its own High-band skills
   * (levelFromSkills). */
  RANK_ROWS: { rank_0: { anchor: 15, level: 1, training: 0 }, rank_1: { anchor: 30, level: 2, training: 1 }, rank_2: { anchor: 50, level: 8, training: 4 }, rank_3: { anchor: 65, level: 12, training: 8 }, rank_4: { anchor: 75, level: 15, training: 12 }, rank_5: { anchor: 100, level: 20, training: 20 }, rank_6: { anchor: PAST_100.beyond, level: 40, training: 30 }, rank_7: { anchor: PAST_100.mythic, level: 60, training: 40 }, rank_transcendent: { anchor: PAST_100.transcendent, level: 100, training: 45 } /* D-335 placeholder */, rank_8: { anchor: PAST_100.divine, level: 140, training: 50 } } as Record<string, { anchor: number; level: number; training: number }>,
  /** NR40 a: the level read from an NPC's skills times its grandeur (GRANDEUR: the higher of its role's and its theme's;
   * uniques and seats of the Great are always grand) */
  GRANDEUR_LEVEL_MULT: { mundane: 0.75, ordinary: 1, grand: 1.25 } as Record<GrandeurKey, number>,
  /** AB7 a: a rank's training years are human years; a race trains in (its Adult start ÷ this) of them (humans unchanged) */
  TRAINING_ADULT_AGE: 18,
  /** D-314 c (placeholder): from this rank up, an NPC preset's skills skip the raw-skill cap (SKILL_CAP, tagged + TAG_CAP_BONUS),
   * so a Beyond is 150 and a Mythic 200; ranks below it keep the player's cap (NG5 b) */
  NPC_UNCAPPED_FROM: 'rank_6' as const,
  /** NG3: past the last rank row, each step adds this */
  RANK_BEYOND_STEP: { anchor: PAST_100_STEP, level: 40, training: 10 },
  /** TS1 (report card, placeholders): the least achievement XP earned, and the fewest people who know the hero's name,
   * for each rank row's grade; past the last row each step multiplies the last row by GRADE_BEYOND_MULT */
  GRADE_ACH_XP: { rank_0: 0, rank_1: 100, rank_2: 300, rank_3: 1000, rank_4: 3000, rank_5: 10000, rank_6: 30000, rank_7: 100000, rank_transcendent: 300000, rank_8: 1000000 } as Record<string, number>,
  GRADE_KNOWN_BY: { rank_0: 0, rank_1: 1, rank_2: 3, rank_3: 10, rank_4: 30, rank_5: 100, rank_6: 300, rank_7: 1000, rank_transcendent: 3000, rank_8: 10000 } as Record<string, number>,
  GRADE_BEYOND_MULT: 3,
  /** TS1 (report card down to FFF, placeholders): below E's row, the share of the way to it at which each grade starts;
   * rank_0 is F. Combat Power reads FFF 0-9, FF 10-19, F 20-29; nobody knowing the hero's name reads FFF */
  GRADE_LOW_SHARE: { grade_fff: 0, grade_ff: 1 / 3, rank_0: 2 / 3 } as Record<'grade_fff' | 'grade_ff' | 'rank_0', number>,
  /** TC4 a: the Planner's tactics word comes from the NPC's own Battle Sense: the last word whose value it reaches (placeholders; past 100 parked, D-370) */
  TACTICS_FROM: { simple: 0, competent: 35, cunning: 65 } as Record<import('../types').Tactics, number>,
  /** NG2: a role's bands as shares of the rank's anchor */
  ROLE_BAND_SHARE: { high: 1, moderate: 0.8, low: 0.6 },
  /** NG2: one lever over every NPC's skills at once (it took over from points per level) */
  NPC_BAND_MULT: 1,
  /** NG13: the lowest rank of a combat role (fighting experience) and of a civilian role; beasts have none */
  RANK_FLOOR: { combat: 'rank_2', civilian: 'rank_1' } as Record<'combat' | 'civilian', `rank_${number}`>,
  /** NG12: traits drawn from the theme's and role's pools, by rank key; past the last row, +RANK_TRAITS_BEYOND per step */
  RANK_TRAITS: { rank_0: 0, rank_1: 0, rank_2: 0, rank_3: 1, rank_4: 1, rank_5: 2, rank_6: 2, rank_7: 3, rank_transcendent: 3, rank_8: 3 } as Record<string, number>,
  RANK_TRAITS_BEYOND: 1,
  /** NG14: each personality trait of a copy moves by up to this many points, seeded by its ID */
  PERSONALITY_SPREAD: 20,
  /** NG15: a composed NPC's starting Resolve, control and chase range by its role's kind (presets set their own) */
  COMPOSED_NPC: {
    combat: { resolve: 50, control: 'agent', chase: 'ground' },
    civilian: { resolve: 30, control: 'code', chase: 'post' },
    beast: { resolve: 50, control: 'code', chase: 'far' },
  } as Record<'combat' | 'civilian' | 'beast', { resolve: number; control: 'agent' | 'code'; chase: import('../scales').ChaseRange }>,
  /** NG9: each skill moves by up to this share of its band value, seeded by the actor's ID */
  COPY_SPREAD: 0.1,
  /** NG8: skills every NPC has at least at this band when its body can use them: the senses. Dodge is left to roles: at Low it
   * would put the thief's essence (Dodge 2, Insight 1) on every NPC's list (fit 0.6 × 2/3 = ESSENCE_FIT_SHARE) */
  NPC_COMMON_SKILLS: { [SK.eyesight]: 'low', [SK.earshot]: 'low' } as Record<string, 'high' | 'moderate' | 'low'>,
  CREATION_POINTS: 100, // every Start's point-buy
  START_LEVEL: 4, // EQ13: a Start's level when its row names none (every Start names 1 today)
  CREATION_MAX_UNTAGGED: 30, // the most points one untagged skill can take at creation
  CREATION_MAX_TAGGED: 40, // the most points one tagged skill can take at creation
  CREATION_TAG_BONUS: 10, // YB1: a tagged skill starts this much above the points spent on it, on top of CREATION_MAX_TAGGED
  CREATION_MAX_FLAWED: 20, // FC3: the most points one flawed skill can take at creation
  // Character age (AG1–AG22; placeholders)
  YEAR_DAYS: 365, // AG2: game days in a year; age = (today − birth day) ÷ YEAR_DAYS
  AGE_PLUS_NUMBER_FROM: 4, // AG7: from this many steps past the last life stage the name reads "Ancient +4" instead of "Ancient++++"
  AGE_DECLINE_FROM: 'stage_4' as import('../scales').LifeStageKey, // AG17: decline starts at the start of Old
  MAP_ELDER_FROM: 'stage_4' as import('../scales').LifeStageKey, // MAP-69 (RM15 c): from this life stage seen on a person (Old, where AG17's decline starts) their map disc shows an elder with a cane
  /** MAP-69 (placeholder, RX2 b): a person's icon is left off when it would be drawn smaller than this many px (it scales
   *  with their body at the zoom shown, so far out it is too small to make out) */
  MAP_WHO_ICON_MIN_PX: 6,
  AGE_DECLINE_GROUPS: [GR.melee, GR.ranged, GR.defense, GR.health, GR.stealth, GR.sleight, GR.notice] as string[], // AG19: body skills and the senses (Sleight: FL1, fingers)
  CREATION_AGE_DEFAULT: 20, // AG15: the creation picker's default (a start may set its own, ClassDef.creation.age)
  YOUNGEST_STAGE: 'stage_1' as import('../scales').LifeStageKey, // no children: no one in the game, player or NPC, is younger than this stage's start (Youth)
  NPC_AGE_STAGES: ['stage_2', 'stage_3'] as import('../scales').LifeStageKey[], // AG13: the stages an NPC is drawn from when its template names none
  /** AG23: each talent row's multiplier on a rank's training years; past the last row each step multiplies by TALENT_BEYOND_MULT */
  TALENT_MULT: { talent_0: 3, talent_1: 2, talent_2: 1, talent_3: 0.75, talent_4: 0.5 } as Record<string, number>,
  TALENT_BEYOND_MULT: 0.5,
  NPC_TALENT_DEFAULT: 'talent_2' as import('../scales').TalentKey, // AG24, AG25: Able, a real professional's pace, when neither the preset nor its theme names one
  CREATION_TAGS: 3,
  CREATION_FLAWS: 3, // FC1: one flaw per tag, required
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
  REPEAT_TRY: 20, // % of the average roll per earlier try (D-76)
  /** DS6 (PLACEHOLDER, 0 until DS8 is answered): a weapon in hand on the speaker's own roll, % of the average roll; up on a threat, down on persuading and haggling */
  STEEL_SPEECH: { [SK.intimidation]: 0, [SK.persuasion]: 0, [SK.barter]: 0 } as Record<string, number>,
  HARD_BARGAIN_BUY: 0.9,
  HARD_BARGAIN_SELL: 1.1,
  SELL_SHARE: 0.5, // SL1: a Trader pays this share of an item's value (rounded down, at least 1)
  TRADER_PURSE: 50, // SL3: coin every Trader carries when the Weaver places it
  QUALITY_PRICE_FACTOR: 2, // SL8: a minted item's value is its base value × this × its quality (1–4)
  /** SL12 b / SL14: the coin each benefit number is worth; an item's value is its benefits summed (src/ruleset/value.ts).
   * skillPoint: per point of skill bonus (a roll bonus counts as the skill points that move a roll as much);
   * reachM: per metre of reach (its best attack mode; ZR7: 5 coin per 8 m, the old link rate, placeholder); armorStop: per point of damage stopped, per part covered;
   * armorCut: per percent of damage cut by the armor multiplier, per part covered; poolPoint: per point of a shield or armor pool;
   * IR4 (placeholders): dps: per point of damage a second (class damage over its attack's Action times seconds); reachRangedM: per
   * metre of a ranged weapon's range (a melee weapon's or a throw's reach takes reachM). A class's hit is not priced: it is the class's trade against its damage */
  ITEM_VALUE: { skillPoint: 1, reachM: 0.625, reachRangedM: 0.1, dps: 1, armorStop: 2, armorCut: 0.1, poolPoint: 0.25 },
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
  HEAD_WARN_SHARE: 0.75, // placeholder: share of the 256 KiB document limit at which a save's head files head_large
  TURN_ENDS_KEPT: 500, // AT15/AT43: turn end times kept for timers (more than the longest timer needs at the shortest turn)
  HISTORY_CHUNK_TURNS: 20, // Q18: story text saved in documents of this many turns each
  LOCK_LEASE_MS: 60_000, // Q2
  /** WT1 a, WT2 b: the floor plan and loose items are saved in square tiles of the world frame this many metres a side
   * (tile.<tx>.<ty>.<n> pages); a change takes effect at the next save, and saves tiled at another size still load */
  TILE_SIZE_M: 100,
  SCHEMA_VERSION: 14, // v14: knownOnSight names its reach (KN1 b); v13: the floor plan and the ground saved by tiles (WT1 a); v12: item pool bands (D-89 RP12); v11: doorways hold real doors (BG-312); v10: titles and the floor plan (PZ16 b); v9: land (regions, WZ12)
  /** MG2: a save older than this is refused (the prototype keeps no old saves, D-116); OLDEST_SAVE_REASON ends "this save was made …" */
  OLDEST_SAVE_SCHEMA: 10,
  OLDEST_SAVE_REASON: 'before zones became titles on a floor plan (walls, doors and light at points)',
};
