// Every tunable value. Spec "placeholder" values are config, not constants.
// Values marked Q2 are placeholders the spec names without a value (asked in the build plan, question 2).
// Read CONFIG at call time (tests may change a value and call resetConfig()).

const DEFAULTS = {
  // ---- Part 1 ----
  SUBSTITUTE_EFFICIENCY: 0.3, // F4 (Ali, 08/11/2026): was 0.5; perks can change it (PerkDef.standIn)
  /** Skill tiers (Ali, 08/11/2026): the final efficiency multiplier by SKILL_TIERS key. tier_1 is a placeholder (Ali gave 0 and 2). */
  SKILL_TIER_MULT: { tier_0: 0.5, tier_1: 0.75, tier_2: 1 } as Record<string, number>,
  /** A7 Open-Hand Guard: share of a hit through an open-hand block that lands on the blocking arm; the rest goes to the general area (placeholder, Ali 07/11/2026) */
  OPEN_HAND_ARM_SHARE: 0.5,
  /** A6 Leg Bolt: the leg's pool takes this multiple of the damage the hit puts on the health track (Ali, 07/11/2026) */
  LEG_BOLT_PART_MULT: 1.5,
  /** Per-check substitutes (Ali, 07/11/2026): a skill listed here replaces the flat SUBSTITUTE_EFFICIENCY with its own
   * table of skill functions and the share each substitute counts at. Grapple: other unarmed skills 0.4×, melee 0.2×. */
  SUBSTITUTES: {
    unarmed_grapple: [{ fn: 'unarmed', k: 0.4 }, { fn: 'arms', k: 0.2 }],
  } as Record<string, { fn: string; k: number }[]>,
  SITUATION_BASE: 50,
  DIFFICULTY: { none: 20, minor: 35, moderate: 50, major: 65, extreme: 80 } as Record<string, number>,
  SKILL_WEIGHT: 0.5,
  ROLL_NEEDED: 63.5,
  STACK_2: 0.5,
  STACK_3: 0.25,
  KIT_BONUS: 25,
  POTENTIAL: 300,
  K: 20,
  /** SP2 (Ali, 07/11/2026): a use marks its skill when the opposition is within ± this of raw or true skill (placeholder) */
  MARK_WINDOW: 10,
  /** SP5: a hit costing this much health (%) or more marks endurance (placeholder) */
  ENDURANCE_MARK_PCT: 10,
  // ---- Part 3 ----
  HP_BASE: 50,
  HP_PER_END: 1,
  HEALTH_SHOWN_FROM: 'Wounded', // others' health level shows from this level down (Voyage C2)
  /** health % lost stops here: Dead at 150% (Ali, 08/11/2026) */
  HP_LOST_MAX: 150,
  HEALTH_TRACK: [
    // [level, max % lost, wounds modifier]
    ['Unhurt', 0, 0], ['Bruised', 15, 0], ['Hurt', 30, -5], ['Injured', 45, -10],
    ['Wounded', 60, -15], ['Mauled', 75, -20], ['Critical', 99.999, -30], ['Incapacitated', 149.999, 0],
    ['Dead', Infinity, 0], // Ali 08/11/2026: dead at 150% lost (was 200%); never shown in the UI
  ] as [string, number, number][],
  PART_SHARE: { tiny: 0.15, extra_small: 0.15, small: 0.2, normal: 0.3, big: 0.5 } as Record<string, number>,
  HIT_WEIGHT: { tiny: 0.25, extra_small: 0.5, small: 1, normal: 2, big: 4 } as Record<string, number>,
  AIM_PENALTY: { tiny: -40, extra_small: -35, small: -30, normal: -20, big: -10, general: 0 } as Record<string, number>,
  GENERAL_MIN_PCT: 30,
  GENERAL_BIG_WEIGHT: 4,
  IMPACT_MULT: { non_essential: 0, normal: 1, essential: 1.5 } as Record<string, number>,
  ROLE_PENALTY: { damaged: -10, crippled: -20 },
  SHARED_ROLE_OFF_PCT: 0.6,
  WEAPON_CLASSES: {
    light: { damage: 20, hit: 10 }, medium: { damage: 25, hit: 0 }, heavy: { damage: 30, hit: -10 },
    punch: { damage: 15, hit: 10 }, slam: { damage: 20, hit: 10 },
    grapple: { damage: 5, hit: 0 }, // grab and wrench (placeholder, 07/11/2026): anyone can grapple; Hold (A8) locks on
  } as Record<string, { damage: number; hit: number }>,
  UNARMED_PROFILE: { damage: 15, hit: 10 },
  HEAVY_VS_BLOCK_GAP: -1,
  GAP_LADDER: {
    dodge: { [-5]: 2, [-4]: 1.5, [-3]: 1, [-2]: 1, [-1]: 1, 0: 1, 1: 0.8, 2: 0, 3: 0, 4: 0, 5: 0 },
    block: { [-5]: 2, [-4]: 1.5, [-3]: 1, [-2]: 1, [-1]: 1, 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0.2, 5: 0.15 },
  } as Record<'dodge' | 'block', Record<number, number>>,
  DODGE_VS_MISSILE: 10,
  OUTNUMBERED_MOD: -5, // Q2 (D-76)
  UNAWARE_MOD: -10, // Q2 (D-76)
  INIT_UNAWARE: 0, // Q2: unaware actors act last
  ENGAGEMENT_END_TURNS: 2, // E1 (Ali, 07/11/2026): an engagement ends after this many turns with no one engaged with the actor
  RANGE_MODS: { 0: -10, 1: 0, 2: -5, 3: -10, 4: -15 } as Record<number, number>,
  LIGHT_MODS: { bright: 0, dim: -5, dark: -10 } as Record<string, number>, // keyed by LIGHT key
  COVER_GAP: { none: 0, some: 1, heavy: 2 } as Record<string, number>, // keyed by COVER key
  // GAP (placeholders): zone links an event reaches, [full, partial], per NOISE / VISIBILITY key. −1 = nowhere, the step
  // below 0 (same zone), so a +1 link bonus turns nowhere into same zone (Ali, 08/11/2026).
  // Sound from another zone is partial except Deafening (NV6). A dark zone caps sight at partial.
  // NV1–NV6 (Ali, 08/11/2026): Loud and Deafening carry further (NV6); Deafening is heard clearly one link away.
  NOISE_REACH: { silent: [-1, -1], faint: [-1, 0], hushed: [0, 0], quiet: [0, 1], normal: [0, 2], loud: [0, 4], deafening: [1, 6] } as Record<string, [number, number]>,
  SIGHT_REACH: { unseen: [-1, -1], faint: [-1, 0], close: [0, 0], low: [0, 1], normal: [1, 2], high: [2, 3], glaring: [3, 4] } as Record<string, [number, number]>,
  /** ST21 (Ali, 08/11/2026): which situation tags each situational table reaches, and the sign (+ helps the roll's owner).
   * light adds sign × LIGHT_MODS[the light where the action is] to the roll; cover is sign × COVER_GAP[the zone's cover]
   * in tiers (a ranged attack: a gap shift). A skill's tags are in the library (SkillDef.tags); linking a table is a row here. */
  SITUATION_TAGS: { light: { sight: 1, stealth: -1 }, cover: { hide: 1, ranged: -1 } } as Record<'light' | 'cover', Partial<Record<import('./types').SituationTag, number>>>,
  MORALE_DEFAULT: 50,
  PERSONALITY_MORALE: { fearless: null, bold: 70, steady: 50, timid: 30 } as Record<string, number | null>,
  REST_COOLDOWN_MIN: 240, // T7: game minutes between rests (placeholder)
  // ---- game clock (T1-T8, Ali 07/11/2026); durations per action are the library's durations table ----
  TIME_OF_DAY_FROM: { dawn: 5 * 60, day: 7 * 60, dusk: 18 * 60, night: 20 * 60 } as Record<string, number>, // minute of the day each starts (placeholders)
  SKY_LIGHT: { dawn: 'dim', day: 'bright', dusk: 'dim', night: 'dark' } as Record<string, string>, // T3a: outdoor light by time of day (LIGHT keys)
  TIME_TAGS: { dawn: ['day', 'night'], day: ['day'], dusk: ['day', 'night'], night: ['night'] } as Record<string, string[]>, // T3b: routine-set time tags that fit
  REST_HEAL_PCT: 25,
  STARTING_BANDAGES: 2, // H2 (placeholder)
  CLINIC_HEAL_PCT: 100,
  // ---- Part 4 ----
  POINTS_PER_LEVEL: 3,
  CREATION_POINTS: 250,
  CREATION_MAX_SKILL: 60,
  CREATION_TAGS: 3,
  STARTING_COIN: 20,
  TURN_RECORDS_KEPT: 20, // N, Q2
  BACKUP_EVERY: 10, // Q2
  BACKUPS_KEPT: 3, // Q2
  HISTORY_CHUNK_TURNS: 20, // Q18: story text saved in documents of this many turns each
  LOCK_LEASE_MS: 60_000, // Q2
  SCHEMA_VERSION: 7, // v2: tiers stored as IDs; v3: every ordered scale stored by key (src/scales.ts); v4: humanoids have two legs; v5: hostile split from opposed; v6: memory notes become memory lists (PM1); v7: event noise and visibility stored by key
  // ---- Part 5 ----
  ACCESSORY_SLOTS: 3,
  ARMOR_PROTECTION: { light: [2, 0.8], medium: [4, 0.65], heavy: [6, 0.55] } as Record<string, [number, number]>,
  ARMOR_DODGE: { light: -5, medium: -10, heavy: -20 } as Record<string, number>,
  // GAP (placeholders, AN1–AN4 Ali 08/11/2026): worn armor makes body-moving events this many NOISE steps louder, per
  // ARMOR_WEIGHTS key. Moving stealthily doesn't cancel it. Quieter-armor perks come later (AN5).
  ARMOR_NOISE_STEPS: { light: 0, medium: 1, heavy: 2 } as Record<string, number>,
  QUALITY_TABLE: {
    hitAdj: [2, 4, 6, 8], damageAdj: [1, 2, 3, 4], reduction: [1, 1, 2, 2], tool: [5, 10, 15, 20],
  },
  STALL_TURNS: 8, // placeholder (Ali, 07/11/2026, P7c): quiet turns with no beat left before a new scene
  IMPROVISED_HIT_ADJ: -10, // placeholder (Ali, 07/11/2026, loot L3)
  // Boon (loot V8, Ali 07/11/2026): a reward's worth to the player. Placeholders, tune after playtests (V8c).
  BOON_COIN: 20, // coin value per Boon, unless the item sets its own boon
  BOON_QUALITY: [1, 2, 3, 5, 8], // multiplier by minted quality (index 0 = not minted)
  BOON_BUDGET: { none: 0, minor: 2, moderate: 5, major: 10, extreme: 20 } as Record<string, number>, // per plan, by gain
  // XP and levels (Ali, 07/11/2026, X1–X10). Placeholders, kept small at first (X1).
  LEVEL_XP: 100, // XP from level n to n+1 = LEVEL_XP × n
  // Kill XP from stats (X18–X23): rating = per category, skills' training effort ranked high to low at 1, ½, ¼…,
  // × the category weight; kill XP = rating × taper × KILL_XP_MULT. Placeholders, tuned later (X19).
  XP_CATEGORY_WEIGHT: { offensive: 1, defensive: 1, endurance: 1, notice: 0.5, influence: 0.25, misc: 0 } as Record<string, number>,
  KILL_XP_MULT: 1, // X20 (Ali, 07/11/2026): ×1 for now
  KILL_XP_TAPER: 2, // × min(1, TAPER × foe rating ÷ player rating) (X19)
  /** XP per reward level (REWARD_LEVELS in src/scales.ts), for achievements and quests (Ali, 07/11/2026) */
  REWARD_XP: { i: 100, ii: 250, iii: 1000, iv: 2000 } as Record<string, number>,
  GAIN_MAX_QUALITY: { none: 0, minor: 1, moderate: 2, major: 3, extreme: 4 } as Record<string, number>,
  // ---- Part 2 engine ----
  DECAY_TURNS: 6, // Q2 (test 72 implies 6)
  MAX_PLANNER_CALLS: 3, // Q2 (D-18)
  MAX_SPOKESPEOPLE: 2, // Q2
  BACKGROUND_WINDOW_MS: 8_000, // Q2 (D-39)
  DIALOGUE_WINDOW_MS: 10_000, // Q2
  WEAVER_TIMEOUT_MS: 120_000, // Q2
  MAX_ROUTE_ZONES: 4, // Q2
  MAX_STAGE_ZONES: 12, // Q2
  PLAN_CAPS: { cast: 8, zones: 8, frontiers: 4, places: 4, bands: 3, knows: 5 }, // Q2
  TEXT_CAP: 200, // Q2: free-text length cap for public text (names, looks, labels, knows)
  NOTE_CAP: 400, // V6: hidden-only notes (summary, goals, motive, Weaver note, secret facts) are trimmed to this
  SCENE_CAPS: { promotions: 3, minted: 2 }, // Q2
  DURATIONS: { brief: 1, short: 3, medium: 6, long: 12 } as Record<string, number>,
  RECENT_EVENTS: 8, // compact views: last few relevant events
  MEMORY_ENTRIES: 8, // PM1 (Ali, 08/11/2026): an NPC's memory list holds at most this many entries (placeholder)
  EARLIER_LINES: 6, // PM6 (Ali, 08/11/2026): code-made lines about events older than RECENT_EVENTS (placeholder)
  SAID_LINES: 6, // P5: an NPC's own last lines in its view, so it stops repeating itself
  STORY_PREMISE: 'A swordsman arrives at a village troubled by slimes',
  SHOW_MECHANICS: true,
  WEAVER_MODEL: 'claude-opus-5-5',
  WEAVER_EFFORT: 'high' as 'low' | 'medium' | 'high',
  MODEL_TIERS: { parser: 'quick', planner: 'default', responder: 'default', voice: 'default', narrator: 'complex', weaver: 'complex' } as Record<string, 'quick' | 'default' | 'complex'>,
  STYLE: { tone: 'grounded low fantasy', length: '2 to 4 short paragraphs' },
};

export type Config = typeof DEFAULTS;
export const CONFIG: Config = structuredClone(DEFAULTS);
export function resetConfig(): void {
  Object.assign(CONFIG, structuredClone(DEFAULTS));
}

