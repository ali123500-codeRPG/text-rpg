// CONFIG defaults: reward worth, XP, levels and ratings. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { DefenseKind } from '../types';
import type { AchBand, QualityKey, QuestRewardLevel } from '../scales';
import type { VowStake } from '../types/state';
import { GR, RT } from '../library/functionIds';
import { SK } from '../library/skillIds';
import { IT } from '../library/itemIds';

export const PROGRESSION = {
  // Boon (loot V8): a reward's worth to the player. Placeholders, tune after playtests (V8c).
  BOON_COIN: 20, // coin value per Boon, unless the item sets its own boon
  BOON_QUALITY: { plain: 1, quality_1: 2, quality_2: 3, quality_3: 5, quality_4: 8 } as Record<QualityKey | 'plain', number>, // Boon multiplier by minted quality (plain: not minted)
  BOON_BUDGET: { none: 0, minor: 2, moderate: 5, major: 10, extreme: 20 } as Record<string, number>, // per plan, by gain
  BOON_PAST_CRIT_MULT: 1.5, // D-216c a: the budget × this per step past Critical Success (placeholder)
  // XP and levels (X1–X10). Placeholders, kept small at first (X1).
  LEVEL_XP: 100, // XP from level n to n+1 = LEVEL_XP × √(n² + LEVEL_XP_EARLY²), rounded
  /** the early bump in the XP curve (placeholder): every level costs more than the one before, the XP that used to reach
   * level 10 (LEVEL_XP × n) reaches level 8, and the cost of a level bends back to LEVEL_XP × n as n grows */
  LEVEL_XP_EARLY: 4.75,
  PERK_POINT_EVERY: 2, // Part 1 §5: a perk point at every character level that is a multiple of this (every even level)
  /** no class levels higher than this; XP past a class's top level banks until a class with room is picked */
  CLASS_MAX_LEVEL: 20,
  /** CB5: Late Bloom gives the double improvement roll to a skill whose raw is below this share of the owner's highest raw skill (placeholder) */
  LATE_BLOOM_SHARE: 0.5,
  /** UL1: Any Road Will Do adds this to the stand-in share of every function (placeholder) */
  UL_STAND_IN_ADD: 0.2,
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
  XP_GROUP_FACTOR: { [GR.melee]: 'full', [GR.ranged]: 'full', [GR.defense]: 'full', [GR.health]: 'full', [GR.notice]: 'half', [GR.stealth]: 'three_quarters', [GR.sleight]: 'three_quarters', [GR.influence]: 'quarter', [GR.speed]: 'none', [GR.will]: 'full', [GR.stamina]: 'quarter', [GR.medicine]: 'half', [GR.tactics]: 'half' } as Record<string, string>,
  DEFEAT_XP_MULT: 1, // X20: ×1 for now
  /** a skill's worth in the rating (LF15): SKILL_RATING_AT_50 × (s ÷ 50)^SKILL_RATING_POWER, s = true skill × tier; no cap */
  SKILL_RATING_AT_50: 23.1,
  SKILL_RATING_POWER: 2,
  /** GR1: in a skill group's pool the worths count highest first at 1, then × this each step (½, ¼…) */
  RATING_SHARE_STEP: 0.5,
  /** GR10, GR36: compound ratings, each pooling the skills of these groups (a skill once, even when it names two) */
  RATINGS: { [RT.melee_strength]: [GR.melee, GR.health], [RT.ranged_strength]: [GR.ranged, GR.health], [RT.toughness]: [GR.health, GR.defense],
    [RT.agility]: [GR.speed, GR.stealth], [RT.presence]: [GR.influence, GR.will], [RT.senses]: [GR.notice] } as Record<string, string[]>,
  /** GR11: an action that needs strength takes the best kind × its share (placeholders) */
  STRENGTH_KINDS: { break: { [RT.melee_strength]: 1, [RT.ranged_strength]: 0.5 } } as Record<string, Record<string, number>>,
  /** GR26: breaking free of a hold, both sides add this × their Melee strength (Grapple left out of its pool) to the Grapple roll (placeholder) */
  STRENGTH_HOLD_SHARE: 0.5,
  /** levels in the rating, both sides: this share of the XP the actor's levels cost (xpToReach) */
  LEVEL_RATING_SHARE: 0.02,
  DEFEAT_XP_TAPER: 2, // × min(1, TAPER × foe rating ÷ player rating) (X19)
  // PLACEHOLDER: the combat rating's equation (src/engine/combatLevel.ts). An actor's combat level is the level of the
  // reference fighter (the standard soldier) it fights evenly; the equation has no lever of its own: only who the soldier is.
  /** extra tier bands each way the model's rolls reach (balance models count tiers with no end) */
  MODEL_TIER_REACH: 40,
  /** the reference fighter: a human with these skills all at the level, holding and wearing this kit, standing in this defense */
  MODEL_REF_SKILLS: [SK.melee_medium, SK.parry, SK.endurance, SK.medium_armor, SK.resolve, SK.battle_sense] as string[],
  /** GR40: its kit are relics of these pieces whose requirement is the level itself (every stat that scales with need follows) */
  MODEL_REF_KIT: [IT.arming_sword, IT.mail_hauberk] as string[],
  MODEL_REF_DEFENSE: 'parry' as DefenseKind,
  /** GR34, GR42: the XP rating's non-combat groups and how each one's share of an equal fight is worked out
   * (engine/nonCombat.ts): slip past or filch unseen, catch a sneaker, talk a fight down, heal */
  NONCOMBAT_SHARES: { [GR.stealth]: 'slip', [GR.notice]: 'catch', [GR.sleight]: 'slip', [GR.medicine]: 'heal', [GR.influence]: 'talk_down' } as Record<string, import('../engine/nonCombat').ShareRule>,
  /** D-111 Bane bonuses: an achievement earned against a race or body type gives this much skill on
   * top of the bonus of the lower level it builds on, its own step growing with its place (BG-256: I = +5, II = +15, III = +30), on rolls against that race or type. The best race one and the best body type one both count, stacked as one modifier type */
  BANE_SKILL_PER_LEVEL: 5,
  /** D-119: a total-defeats achievement adds this much to every attack and defense roll times its place, added to the lower tiers' steps (BG-256: I = +1, II = +3, III = +6, IV = +10) */
  DEFEATS_ROLL_PER_TIER: 1,
  /** the outnumbered achievement: the most foes fighting the player at once, with no one on the player's side */
  OUTNUMBERED_FOES: 3,
  /** DI20: Not One Step's branches, fights held in place against at least this many foes (the trunk asks OUTNUMBERED_FOES; placeholders) */
  HELD_GROUND_FOES: [5, 10],
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
  MIND_OVER_BODY_SHARE: 0.25, // All-100 Mind Over Body (Resolve's part): share of Resolve that adds to health, as Endurance does (placeholder)
  GRIT_SHARE: 0.25, // All-50 Grit (Resolve's part): share of Endurance that augments Resolve (placeholder)
  TAKES_ONE_SHARE: 0.2, // GU2 b: Takes One to Know One: the unpicked skill of the pair augments the picked one by this share (placeholder)
  MISDIRECTION_SHARE: 0.25, // All-50 Misdirection (Vanishing's part): share of Guile that augments Vanishing (placeholder)
  THICK_HIDE_MULT: 0.95, // All-50 Thick Hide: health lost from each hit (placeholder)
  /** XP per reward level (REWARD_LEVELS in src/scales.ts), one equation for achievements and quests with no top:
   * XP = base × ((p + shift) ÷ div)^power, p = the level's place (0 = level 0, I = 1, −1 = −1); read through rewardXp */
  REWARD_XP_CURVE: { base: 50, shift: 2, div: 2, power: 3 },
  /** AL1-AL8: every reward also pays a share of the earner's XP to the next level, in the same equation:
   * + (floor + (atI − floor) × max(0, p)^power) × xpToNext. Level I pays atI, VI about 30%; level 0 and below (scars there
   * too) pay the floor; power under 2 (weaker than squared). All placeholders. */
  ACH_LEVEL_SHARE: { floor: 0.005, atI: 0.02, power: 1.67 },
  /** AV1: the lowest reward level (REWARD_LEVELS key) of each prominence band above Minor (ACH_BANDS): below the first
   * cut an achievement is Minor; levels past XV stay Legendary. Read only through achBand. Placeholders. */
  ACH_BAND_FROM: { notable: 'i', major: 'iii', legendary: 'vi' } as Record<Exclude<AchBand, 'minor'>, string>,
  /** QT9: a quest's reward level from the scenario's gain grade when it is accepted (iv is kept for later story quests) */
  QUEST_GAIN_LEVEL: { none: 'zero', minor: 'zero', moderate: 'i', major: 'ii', extreme: 'iii' } as Record<string, QuestRewardLevel>,
  /** a quest pays the XP of the achievement reward level this many places above its own (quest 0 = achievement II) */
  QUEST_XP_LEVELS_UP: 2,
  GAIN_MAX_QUALITY: { none: null, minor: 'quality_1', moderate: 'quality_2', major: 'quality_3', extreme: 'quality_4' } as Record<string, QualityKey | null>, // null: no minted item
  /** D-141 vows: at most this many active at a time (VW7 a, placeholder) */
  VOW_MAX_ACTIVE: 3,
  /** VW4: the stakes a vow may be sworn at, rows of REWARD_LEVELS: keeping pays that level's Thread (rewardXp), breaking
   * takes the same (VW5 a) */
  VOW_STAKES: ['i', 'ii', 'iii'] as VowStake[],
  /** VW6 a: a vow's deadline in game days, from this to this (placeholders) */
  VOW_DAYS_MIN: 1,
  VOW_DAYS_MAX: 30,
  /** VW10 a: the scenario band (gain grade) each stake pays in; its BOON_BUDGET is what a kept vow's items fill */
  VOW_STAKE_GAIN: { i: 'minor', ii: 'moderate', iii: 'major' } as Record<VowStake, string>,
  /** VW15: a kept vow draws items until their Boon is within this share either side of the band's budget (placeholder) */
  VOW_REWARD_MARGIN: 0.1,
  /** draws a kept vow makes at most, so a table of items too dear (or worth nothing) cannot draw for ever (placeholder) */
  VOW_REWARD_DRAWS_MAX: 20,
};
