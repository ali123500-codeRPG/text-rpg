// Library content shapes (Part 1 §3 skills, Part 3 body type database, Part 4 classes/templates, Part 5 items, routine bank).
import type { AttackMode, ItemDef } from './items';
import type { NpcTemplate } from './actor';
import type { ActivityDef, Routine, RoutineSet } from './hidden';
import type { EntryStatus } from './state';
import type { PartStateKey, SkillTierKey } from '../scales';

export type SkillFunction = 'melee_attack' | 'ranged_attack' | 'unarmed_attack' | 'defense' | 'notice' | 'influence' | 'hp' | 'stealth';
/** XP rating category of a skill (Ali, 07/11/2026, X18–X23). Set per skill: one tree may mix categories. */
export type XpCategory = 'offensive' | 'defensive' | 'endurance' | 'notice' | 'influence' | 'misc';
/** Situation tags (Ali, 08/11/2026, ST21): a situational table (CONFIG.SITUATION_TAGS) affects a roll whose skill has its tag. */
export type SituationTag = 'sight' | 'hearing' | 'stealth' | 'hide' | 'ranged';
export type RoleId = 'sense' | 'grip' | 'move' | 'fly' | 'strike' | 'speech';
export type SizeId = 'tiny' | 'extra_small' | 'small' | 'normal' | 'big';
export type ImpactId = 'non_essential' | 'normal' | 'essential';

export type SkillDef = {
  id: string;
  treeId: string;
  functions: SkillFunction[];
  roles: RoleId[]; // body-part roles the skill uses (wounds reach a roll through these)
  cue?: 'sight' | 'sound'; // Notice skills: which cue they read
  xpCategory: XpCategory;
  tier: SkillTierKey; // final efficiency multiplier (CONFIG.SKILL_TIER_MULT)
  tags?: SituationTag[]; // situation tags (ST21): which situational tables reach its rolls
};
/** A source that opens or blocks a skill tree (Ali, 08/11/2026, TA1–TA11). 'class': the actor has that class, Current or
 * Previous, at `level` or more (default 1, TA3); 'perk': the actor owns that perk or quirk. */
export type AccessCond = { kind: 'race' | 'body' | 'class' | 'perk'; id: string; level?: number };
/** TA1/TA2: a tree opens when every `must` holds and, if `either` is listed, at least one of those; any `blockedBy`
 * closes it, and a block always wins. No access rule: open to everyone. */
export type TreeAccess = { must?: AccessCond[]; either?: AccessCond[]; blockedBy?: AccessCond[] };
export type TreeDef = { id: string; name: string; skills: string[]; access?: TreeAccess };
export type ClassDef = { id: string; name: string; floors: Record<string, number> };

export type PartDef = { id: string; size: SizeId; impact: ImpactId; roles: RoleId[]; adjacent?: string[] };
export type NaturalArmor = { covers: string[]; reduction: number; multiplier: number; pools?: Record<string, number> };
/** BR1 (Ali, 08/11/2026): a body type is the shape only: parts, general area, silhouette, and the attacks the shape
 * always has (BR3). Toughness, natural armor and a being's own attacks are on its race. */
export type BodyType = {
  id: string;
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
  durations?: Record<string, DurationDef>; // T1: how long each action takes on the game clock
  races?: Record<string, RaceDef>; // Part 4 §4: a race sets the body type and its innate perks and quirks
  achievements?: Record<string, AchievementDef>; // X6: awarded by code rules only
};

/** Perk page S1–S9 (Ali, 07/11/2026): a ladder perk sits on one milestone of one skill; trueSkill is its flat boost to
 * that skill (milestones 40/80/120); effect groups it in the "By effect" view. */
export type PerkEffect = 'attack' | 'defense' | 'health' | 'speed' | 'senses' | 'speech';
export type PerkDef = {
  id: string; name: string; text?: string; situation?: number;
  ladder?: { skill: string; milestone: number }; trueSkill?: number; effect?: PerkEffect;
  /** 40/80/120 perks (40/80/120): true skill added to other skills, +functionBoost to every other skill sharing a function
   * with the ladder skill, and the ladder skill's own numbers (src/library/boostPerks.ts) */
  trueSkillTo?: Record<string, number>; functionBoost?: number; numbers?: BoostNumbers;
  /** player-facing write-up (the Story view); must say the same thing as `rules` */
  story?: string;
  /** exact rules code applies (the Rules view, and the basis for building the perk) */
  rules?: PerkRules;
  /** false: written down but not coded yet, so it can't be taken */
  built?: boolean;
  /** a quirk: a perk that is negative in nature (Ali, 08/11/2026) */
  quirk?: boolean;
};
/** a 40/80/120 perk's numbers; each applies only to rolls of the perk's own ladder skill */
export type BoostNumbers = { aimMult?: number; damageMult?: number; armorPierce?: number; recoveryMult?: number; hitAdd?: number; rollAdd?: number };
export type PerkRules = { kind: string; trigger: string; conditions: string[]; effect: string; lasts: string; cooldown?: string; needs?: string; open?: string };
/** a chosen or banked perk write-up (src/library/perks.ts): ref is its review-page id; place is where it sits for now */
export type PerkWriteup = PerkDef & { ref: string; skill: string; place: '20' | '40' | 'higher' | 'very_high' | 'banked'; story: string; rules: PerkRules };

/** X6/X11 (Ali, 07/11/2026): a library achievement, each with its own id and name. 'defeats' is earned at `count`
 * defeats (first defeat = count 1). With `by`, it is earned once per body type or race: the granted id is
 * <id>:<type or race> and {body_type}/{race} in the name become what was defeated. 'mastery' once per tree when all three
 * of its skills reach `count` (50/100/150), id <id>:<tree> (awarded when mastery perks exist). */
/** How long an action takes on the game clock (T1, Ali 07/11/2026). `orders` lists the order types the row covers;
 * the row with no `orders` named 'action' is the default; 'fight_turn' is every turn of a fight; 'sleep' is one sleep. */
export type DurationDef = { id: string; name: string; minutes: number; orders?: string[] };

/** A healing source (Ali, 07/11/2026, H1/H12): what it restores, the worst part state it can heal (`reach`, a
 * PART_STATES key), whether it works in a fight, and what it needs (a place kind; an item names its source with
 * ItemDef.heal). `hourly` makes it passive: per game hour it restores skill × pctPerPoint % (H12). */
export type HealingDef = {
  id: string; name: string; hpPct: number; partPct: number; reach: PartStateKey; inFight: boolean; placeKinds?: string[];
  /** heals a Dead actor (Ali, 08/11/2026: no for every row for now; a lever for resurrection later) */
  revivesDead: boolean;
  hourly?: { skill: string; pctPerPoint: number };
};

/** innatePerks / innateQuirks (Ali, 08/11/2026): perk ids every member of the race is born with (OwnedPerk source 'race').
 * Any number of each; empty = none chosen yet. Innate perks must not be quirks, innate quirks must be. */
/** BR1–BR6 (Ali, 08/11/2026): a race is what the being is. It names exactly one body type (BR5), its HP multiplier
 * (BR2) and natural armor (BR6), and adds its own natural attacks and fallback skill to the shape's (BR3). */
export type RaceDef = {
  id: string; name: string; bodyTypeId: string; hpMultiplier: number;
  naturalAttacks?: AttackMode[]; naturalArmor?: NaturalArmor; fallback?: { attackSkill: string };
  innatePerks?: string[]; innateQuirks?: string[];
};

/** level: a REWARD_LEVELS key; its XP is CONFIG.REWARD_XP[level] */
export type AchievementDef = { id: string; name: string; level: string; rule: 'defeats' | 'mastery'; count?: number; by?: 'body_type' | 'race' };
