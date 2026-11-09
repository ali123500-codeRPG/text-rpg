// Library content shapes (Part 1 §3 skills, Part 3 body type database, Part 4 classes/templates, Part 5 items, routine bank).
import type { IntelligenceKey } from '../scales';
import type { AttackMode, ItemDef } from './items';
import type { NpcTemplate } from './actor';
import type { ActivityDef, Routine, RoutineSet } from './hidden';
import type { EntryStatus } from './state';
import type { FN, GR } from '../library/functionIds';
import type { PartStateKey, SkillTierKey } from '../scales';

/** F1–F8: a skill lists one or more narrow functions; stand-ins read them. Each function belongs to one
 * broad group (FUNCTION_GROUP, src/library/functionNames.ts); the 40 perk's +1 and the XP category read the group. */
export type SkillFunction = (typeof FN)[keyof typeof FN]; // fixed IDs: src/library/functionIds.ts
export type SkillGroup = (typeof GR)[keyof typeof GR];
/** XP rating category of a skill (X18–X23). Set per skill: one tree may mix categories. */
export type XpCategory = 'offensive' | 'defensive' | 'endurance' | 'notice' | 'influence' | 'misc';
/** Situation tags (ST21): a situational table (CONFIG.SITUATION_TAGS) affects a roll whose skill has its tag. */
export type SituationTag = 'sight' | 'hearing' | 'stealth' | 'hide' | 'ranged';
export type RoleId = 'sense' | 'grip' | 'move' | 'fly' | 'strike' | 'speech';
export type SizeId = 'tiny' | 'extra_small' | 'small' | 'normal' | 'big';
export type ImpactId = 'non_essential' | 'normal' | 'essential';

export type SkillDef = {
  id: string;
  treeId: string;
  functions: SkillFunction[];
  groups?: SkillGroup[]; // groups the skill joins directly, without that group's function (Dodge: Speed)
  roles: RoleId[]; // body-part roles the skill uses (wounds reach a roll through these)
  cue?: 'sight' | 'sound'; // Notice skills: which cue they read
  xpCategory: XpCategory;
  tier: SkillTierKey; // final efficiency multiplier (CONFIG.SKILL_TIER_MULT)
  tags?: SituationTag[]; // situation tags (ST21): which situational tables reach its rolls
  access?: TreeAccess; // a skill's own rule on top of its tree's (SR1: persuasion and barter need a speaking race)
};
/** A source that opens or blocks a skill tree (TA1–TA11). 'class': the actor has that class, Current or
 * Previous, at `level` or more (default 1, TA3); 'perk': the actor owns that perk or quirk. */
/** raceTag: the actor's race carries that tag (RaceDef.tags), e.g. 'speaks' */
/** One access condition. Count kinds read `level` as the count: 'classes' = classes on the sheet in any state (id unused);
 * 'allStep' = trees whose All-XXX at step `id` (e.g. '50') the actor has; 'skillsAbove' = skills whose true skill is above `id`. */
export type AccessCond = { kind: 'race' | 'raceTag' | 'body' | 'class' | 'perk' | 'skill' | 'classes' | 'allStep' | 'skillsAbove'; id: string; level?: number };
/** TA1/TA2: a tree opens when every `must` holds and, if `either` is listed, at least one of those; any `blockedBy`
 * closes it, and a block always wins. No access rule: open to everyone. */
export type TreeAccess = { must?: AccessCond[]; either?: AccessCond[]; blockedBy?: AccessCond[] };
export type TreeDef = { id: string; name: string; skills: string[]; access?: TreeAccess };
/** PY3: a service a seller can offer; heals names the healing row it pays for */
export type ServiceDef = { id: string; name: string; price: number; heals?: string };
export type ClassDef = {
  id: string; name: string; floors: Record<string, number>;
  /** the class's tier (CLASS_TIERS key): how strong it is next to other classes */
  tier: import('../scales').ClassTierKey;
  /** the public stranger label a player starting in this class has */
  label?: string;
  /** a creation option: points to spend and the starting class level; left out = CONFIG.CREATION_POINTS / START_LEVEL */
  creation?: { points?: number; level?: number };
  /** class-level perks: the perk ids granted when the class reaches each level (at creation or on level up) */
  levelPerks?: Record<number, string[]>;
  /** the default capstone: perk ids granted when the class reaches its top level (classMaxLevel, set by its tier) */
  capstone?: string[];
  /** true skill each skill needs before a character without this class unlocks it */
  unlock?: Record<string, number>;
  /** either-of unlock: at least one of these skills must also reach its true skill */
  unlockAny?: Record<string, number>;
  /** the default class: unlocked for a player whose current class reaches its top level, so banked XP has somewhere to go */
  fallback?: true;
  /** a perk that unlocks the class for a character who has it (for example a class-level perk of another class) */
  unlockPerk?: string;
  /** alternate capstones: each can replace the default capstone when its conditions hold as the class reaches its
   * top level (Must / Either of / Blocked by, as in tree access) */
  capstones?: { perk: string; needs: TreeAccess }[];
};

export type PartDef = { id: string; size: SizeId; impact: ImpactId; roles: RoleId[]; adjacent?: string[] };
export type NaturalArmor = { covers: string[]; reduction: number; multiplier: number; pools?: Record<string, number> };
/** BR1: a body type is the shape only: parts, general area, silhouette, and the attacks the shape
 * always has (BR3). Toughness, natural armor and a being's own attacks are on its race. */
export type BodyType = {
  id: string;
  /** the shape's display name (its id is BT + a number) */
  name: string;
  general: { name: string; size: SizeId };
  naturalAttacks: AttackMode[];
  parts: PartDef[];
  fallback: { attackSkill: string };
  /** optional body figure for the sheet: an SVG path per part id ('general' for the general area) */
  figure?: { viewBox: string; parts: Record<string, string> };
};

export type Library = {
  version: number;
  status: Record<string, EntryStatus>;
  skills: Record<string, SkillDef>;
  trees: Record<string, TreeDef>;
  classes: Record<string, ClassDef>;
  roles: Record<RoleId, { shared: boolean }>;
  bodyTypes: Record<string, BodyType>;
  items: Record<string, ItemDef>;
  templates: Record<string, NpcTemplate>;
  activities: Record<string, ActivityDef>;
  routines: Record<string, Routine>;
  routineSets: Record<string, RoutineSet>;
  perks: Record<string, PerkDef>;
  healing?: Record<string, HealingDef>; // H1: one table of healing sources
  services?: Record<string, ServiceDef>; // PY3: services sellers offer, by fixed ID (SV…)
  durations?: Record<string, DurationDef>; // T1: how long each action takes on the game clock
  races?: Record<string, RaceDef>; // Part 4 §4: a race sets the body type and its innate perks and quirks
  achievements?: Record<string, AchievementDef>; // X6: awarded by code rules only
  zoneKinds?: Record<string, ZoneKind>; // Z2: every Weaver zone names one
};

/** Z1–Z3: a zone is one open space with nothing in the way inside it, about a room across. A kind fixes
 * indoor or outdoor and gives the default cover and light, which the Weaver may change. */
export type ZoneKind = { id: string; name: string; outdoor: boolean; cover: import('./core').Cover; light: import('./core').Light };

/** Perk page S1–S9: a ladder perk sits on one milestone of one skill; trueSkill is its flat boost to
 * that skill (milestones 40/80/120); effect groups it in the "By effect" view. */
export type PerkEffect = 'attack' | 'defense' | 'health' | 'speed' | 'senses' | 'speech' | 'stealth';
export type PerkDef = {
  id: string; name: string; text?: string; situation?: number;
  ladder?: { skill: string; milestone: number }; trueSkill?: number; effect?: PerkEffect;
  /** 40/80/120 perks (40/80/120): true skill added to other skills, +functionBoost to the ladder skill itself and every other
   * skill sharing a group with it (F1), and the ladder skill's own numbers (src/library/boostPerks.ts) */
  trueSkillTo?: Record<string, number>; functionBoost?: number; numbers?: BoostNumbers;
  /** F4: raises (or, negative, lowers) the owner's stand-in share for skills of function `fn` (every
   * function if left out), on top of CONFIG.SUBSTITUTE_EFFICIENCY or the skill's own table; the share stays within 0–1 */
  standIn?: { add: number; fn?: SkillFunction };
  /** player-facing write-up (the Story view); must say the same thing as `rules` */
  story?: string;
  /** exact rules code applies (the Rules view, and the basis for building the perk) */
  rules?: PerkRules;
  /** false: written down but not coded yet, so it can't be taken */
  built?: boolean;
  /** a quirk: a perk that is negative in nature */
  quirk?: boolean;
  /** an All-XXX part (src/library/allPerks.ts): granted when every skill of the tree reaches `step` true skill */
  allStep?: { treeId: string; step: 50 | 100 | 150 };
  /** true skill added to every skill with this function (Hunter's Eye: +10 to the sight function) */
  fnSkill?: { fn: SkillFunction; add: number };
  /** a class-level perk (ClassDef.levelPerks): the class and level that grant it */
  classLevel?: { classId: string; level: number };
  /** improvement rolls a marked skill gets while its raw value is below `below` (Quick Study: 2 below 15) */
  improveRolls?: { below: number; rolls: number };
};
/** a 40/80/120 perk's numbers; each applies only to rolls of the perk's own ladder skill */
export type BoostNumbers = { aimMult?: number; damageMult?: number; armorPierce?: number; recoveryMult?: number; hitAdd?: number; rollAdd?: number };
export type PerkRules = { kind: string; trigger: string; conditions: string[]; effect: string; lasts: string; cooldown?: string; needs?: string; open?: string };
/** a chosen or banked perk write-up (src/library/perks.ts): ref is its review-page id; place is where it sits for now */
/** What a write-up with no ladder yet is kept for: a later milestone perk of its own skill, an All-X candidate
 * (All-100/150 of the skill's tree), or something else. `aimAt` is the suggested milestone (60/100/140) or All tier (100/150). */
export type BankedAs = 'milestone' | 'allX' | 'other';
export type PerkWriteup = PerkDef & { ref: string; skill: string; place: '20' | '40' | 'higher' | 'very_high' | 'banked' | 'all50'; story: string; rules: PerkRules;
  bankedAs?: BankedAs; aimAt?: number };

/** X6/X11: a library achievement, keyed by its fixed id (ACH in src/library/achievementIds.ts), with a name. 'defeats' is earned at `count`
 * defeats (first defeat = count 1). With `by`, it is earned once per body type or race: the granted id is
 * <id>:<type or race> and {body_type}/{race} in the name become what was defeated. 'mastery' once per tree when all three
 * of its skills reach `count` (50/100/150), id <id>:<tree>. */
/** How long an action takes on the game clock (T1). `orders` lists the order types the row covers;
 * the row with no `orders` named 'action' is the default; 'fight_turn' is every turn of a fight; 'sleep' is one sleep. */
export type DurationDef = { id: string; name: string; minutes: number; orders?: string[] };

/** A healing source (H1/H12): what it restores, the worst part state it can heal (`reach`, a
 * PART_STATES key), whether it works in a fight, and what it needs (a place kind; an item names its source with
 * ItemDef.heal). `hourly` makes it passive: per game hour it restores skill × pctPerPoint % (H12). */
export type HealingDef = {
  id: string; name: string; hpPct: number; partPct: number; reach: PartStateKey; inFight: boolean; placeKinds?: string[];
  /** heals a Dead actor (no for every row for now; a lever for resurrection later) */
  revivesDead: boolean;
  hourly?: { skill: string; pctPerPoint: number };
};

/** innatePerks / innateQuirks: perk ids every member of the race is born with (OwnedPerk source 'race').
 * Any number of each; empty = none chosen yet. Innate perks must not be quirks, innate quirks must be. */
/** BR1–BR6: a race is what the being is. It names exactly one body type (BR5), its HP multiplier
 * (BR2) and natural armor (BR6), and adds its own natural attacks and fallback skill to the shape's (BR3). */
export type RaceDef = {
  id: string; name: string; bodyTypeId: string; hpMultiplier: number;
  naturalAttacks?: AttackMode[]; naturalArmor?: NaturalArmor; fallback?: { attackSkill: string };
  innatePerks?: string[]; innateQuirks?: string[];
  tags?: string[]; // 'speaks': the race can talk, which opens persuasion and barter
  intelligence: IntelligenceKey; // an INTELLIGENCE key (src/scales.ts)
};

/** level: a REWARD_LEVELS key; its XP is CONFIG.REWARD_XP[level].
 * after: the key of the lower level this one builds on. Earning it switches the lower level off,
 * and its Bane bonus is the lower level's bonus plus its own. */
/** what an achievement counts (unordered: names are the ids); its text lives in ACH_RULE_TEXT (achievementIds.ts) */
export type AchievementRule = 'defeats' | 'mastery' | 'unaware_defeats' | 'yielded' | 'crits' | 'beyond_crit' | 'crippled_defeats' | 'zones' | 'deals' | 'days'
  | 'class_unlock' | 'flawless' | 'outnumbered' | 'brink' | 'class_max' | 'class_max_tiers' | 'char_level' | 'held_line';
/** what a per-kind achievement is earned once for: the granted id is <id>:<that kind's id> */
export type AchievementBy = 'body_type' | 'race' | 'group' | 'class' | 'class_tier';
/** scar: a negative achievement, listed under Scars instead of Achievements */
/** an achievement tag: a key of ACH_TAGS in src/library/achievementIds.ts */
export type AchievementTag = 'combat' | 'stealth' | 'social' | 'exploration' | 'survival' | 'skill' | 'progression';
/** a reward field of AchievementDef */
export type AchievementReward = 'perk' | 'unawareShift' | 'quieter' | 'readsHealth' | 'skillAdd' | 'renown' | 'deathsDoor' | 'firstSight'
  | 'standIn' | 'reqLower' | 'pricePct' | 'rally' | 'restPct' | 'situation';
export type AchievementDef = { id: string; name: string; level: string; rule: AchievementRule; tags: AchievementTag[]; count?: number; by?: AchievementBy; after?: string; scar?: true;
  /** rewards beyond XP (src/ruleset/achRewards.ts). A level also gives every reward of the lower levels of its chain,
   * read from their rows; `excludes` names inherited rewards this level drops */
  perk?: string; // granted when earned, kept for good
  unawareShift?: number; // tier steps up on attacks against a target unaware of the owner
  quieter?: number; // the owner's moves are this many steps quieter on the noise scale
  readsHealth?: true; // the owner sees the health level of every member of the achievement's body type or race
  skillAdd?: Record<string, number>; // true skill added to these skills
  renown?: number; // every foe fighting the owner takes this much off its first morale check against the owner
  deathsDoor?: number; // a charge: a hit that would take the owner Down leaves them at Critical; refills after this many game days
  excludes?: AchievementReward[]; // lower levels' rewards this level does not carry up
  standIn?: number; // + this share for stand-ins on rolls of a skill in the achievement's group
  reqLower?: number; // equip requirements on the achievement's tree's skills ask this much less of the owner (the gear's own numbers stay)
  pricePct?: number; // + this % off the owner's buying prices
  rally?: number; // allies fighting beside the owner get + this on their morale checks
  restPct?: number; // + this % HP and part healing on each rest
  situation?: number; // + this on the owner's situation rolls
  firstSight?: IntelligenceKey; // members of the achievement's race or body type, up to this intelligence, meet the owner opposed instead of hostile
  /** earned again at every multiple of this count (granted as `<id>:<n>`), instead of once */
  every?: number };
