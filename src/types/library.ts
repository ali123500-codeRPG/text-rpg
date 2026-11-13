// Library content shapes (Part 1 §3 skills, Part 3 body type database, Part 4 classes/templates, Part 5 items, routine bank).
import type { IntelligenceKey } from '../scales';
import type { AttackMode, ItemDef, RollKind } from './items';
import type { NpcTemplate } from './actor';
import type { ActivityDef, Routine, RoutineSet } from './hidden';
import type { EntryStatus } from './state';
import type { FN, GR } from '../library/functionIds';
import type { HealthLevelKey, PartStateKey, SkillTierKey } from '../scales';

/** F1–F8: a skill lists one or more narrow functions; stand-ins read them. Each function belongs to one
 * broad group (FUNCTION_GROUP, src/library/functionNames.ts); the 40 perk's +1 and the XP category read the group. */
export type SkillFunction = (typeof FN)[keyof typeof FN]; // fixed IDs: src/library/functionIds.ts
export type SkillGroup = (typeof GR)[keyof typeof GR];
/** XP rating category of a skill (X18–X23). Set per skill: one tree may mix categories. */
/** Situation tags (ST21): a situational table (CONFIG.SITUATION_TAGS) affects a roll whose skill has its tag. */
export type SituationTag = 'sight' | 'hearing' | 'stealth' | 'hide' | 'ranged';
export type RoleId = (typeof import('../library/tableIds').RL)[keyof typeof import('../library/tableIds').RL];
export type SizeId = 'tiny' | 'extra_small' | 'small' | 'normal' | 'big';
export type ImpactId = 'non_essential' | 'normal' | 'essential';

export type SkillDef = {
  id: string;
  treeId: string;
  functions: SkillFunction[];
  groups?: SkillGroup[]; // groups the skill joins directly, without that group's function (Dodge: Speed)
  /** skills this skill augments: its effective value × share is added to every roll that asks for that skill,
   * or only rolls of the listed kinds (none listed: every roll and check of that skill) */
  augments?: { skill: string; share?: number; rollKinds?: import('./items').RollKind[] }[];
  roles: RoleId[]; // body-part roles the skill uses (wounds reach a roll through these)
  cue?: 'sight' | 'sound'; // Notice skills: which cue they read
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
export type TreeDef = { id: string; name: string; skills: string[]; access?: TreeAccess;
  /** TREE_RATINGS key (default normal): how many skills at a step earn the tree's All-XXX (CONFIG.ALL_STEP_SKILLS) */
  rating?: import('../scales').TreeRatingKey };
/** PY3: a service a seller can offer; heals names the healing row it pays for */
/** growth proposal 2.2: an essence row. A beaten foe of its race or body type, or a scenario's deeds, can offer it; its points
 * are true skill split over `skills` by weight; a deed row (deed: true) puts its points on the scenario's most-marked skill */
export type EssenceDef = {
  id: string; name: string;
  from: { race?: string; bodyType?: string; deed?: true };
  weight: number;
  skills: { skill: string; weight: number }[];
  trait?: string; quirk?: string; // perk rows (OwnedPerk source 'essence'); none written yet (D-228 content round)
  story: string;
};
export type ServiceDef = { id: string; name: string; price: number; heals?: string };
export type ClassDef = {
  id: string; name: string; floors: Record<string, number>;
  personality?: PersonalityAdd; // PL16: points added while it is the current class
  /** the class's tier (CLASS_TIERS key): how strong it is next to other classes */
  tier: import('../scales').ClassTierKey;
  /** the public stranger label a player starting in this class has */
  label?: string;
  /** flavor text shown with the class; its grandeur grows with the class's tier */
  story?: string;
  /** a creation option: points to spend and the starting class level; left out = CONFIG.CREATION_POINTS / START_LEVEL */
  creation?: { points?: number; level?: number; name?: string; age?: number }; // name: the start's name on the creation screen (default: the class name); age: the age picker's default (AG15)
  /** class-level perks: the perk ids granted when the class reaches each level (at creation or on level up) */
  levelPerks?: Record<number, string[]>;
  /** the default capstone: perk ids granted when the class reaches its top level (classMaxLevel, set by its tier) */
  capstone?: string[];
  /** true skill each skill needs before a character without this class unlocks it */
  unlock?: Record<string, number>;
  /** either-of unlocks: in each group, at least one of the skills must also reach its true skill */
  unlockAny?: Record<string, number>[];
  /** unlocks only for a character with an active perk whose listed numbers reach these (Guard: hearingDb, any perk that sharpens hearing) */
  unlockPerkWith?: { hearingDb?: number };
  /** class levels other classes must reach before this class unlocks; 'max' = that class's top level (kept for D-159) */
  unlockClass?: Record<string, number | 'max'>;
  /** the default class: unlocked for a player whose current class reaches its top level, so banked XP has somewhere to go */
  fallback?: true;
  /** a perk that unlocks the class for a character who has it (for example a class-level perk of another class) */
  unlockPerk?: string;
  /** alternate capstones: each can replace the default capstone when its conditions hold as the class reaches its
   * top level (Must / Either of / Blocked by, as in tree access) */
  capstones?: { perk: string; needs: TreeAccess }[];
};

/** reachM (grip parts): how far the part reaches to take or hand over something, metres from the body (FR2) */
export type PartDef = { id: string; size: SizeId; impact: ImpactId; roles: RoleId[]; adjacent?: string[]; reachM?: number };
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
  /** RD7 base speeds in m/s, from real references: walk (a move slot) and run (a dash); worn armor lowers both (engine/speed) */
  speed: { walk: number; run: number };
  /** optional body figure for the sheet: an SVG path per part id ('general' for the general area) */
  figure?: { viewBox: string; parts: Record<string, string> };
};

/** PL6: one personality axis; `low` and `high` are the words for its two ends */
export type PersonalityAxisDef = { id: string; name: string; low: string; high: string };
/** PL10: a named type: every condition must hold. Keys are personality axes (PA…), 'nerve', or SK.resolve (raw); `hint`
 * tells the agent how the type acts */
export type PersonalityTypeDef = { id: string; name: string; when: Record<string, { min?: number; max?: number }>; hint: string };
/** PL15, PL16: points a perk, class or achievement adds while held, by 'nerve' or personality axis (PA…) */
export type PersonalityAdd = Record<string, number>;

export type Library = {
  version: number;
  status: Record<string, EntryStatus>;
  skills: Record<string, SkillDef>;
  trees: Record<string, TreeDef>;
  classes: Record<string, ClassDef>;
  roles: Record<RoleId, { name: string; shared: boolean }>;
  bodyTypes: Record<string, BodyType>;
  items: Record<string, ItemDef>;
  templates: Record<string, NpcTemplate>;
  activities: Record<string, ActivityDef>;
  routines: Record<string, Routine>;
  routineSets: Record<string, RoutineSet>;
  perks: Record<string, PerkDef>;
  healing?: Record<string, HealingDef>; // H1: one table of healing sources
  composure?: Record<string, ComposureDef>; // what restores morale, apart from healing so each tunes on its own
  fears?: Record<string, FearDef>; // MB21: what costs morale
  personalityAxes?: Record<string, PersonalityAxisDef>; // PL6: PA…
  values?: Record<string, { id: string; name: string }>; // PL19: VL…, what a character cares about
  personalityTypes?: Record<string, PersonalityTypeDef>; // PL10: PY…, named mixes read from the points
  essences?: Record<string, EssenceDef>; // growth proposal: ES…, packages a beaten foe or a scenario's deeds can offer
  services?: Record<string, ServiceDef>; // PY3: services sellers offer, by fixed ID (SV…)
  durations?: Record<string, DurationDef>; // T1: how long each action takes on the game clock
  races?: Record<string, RaceDef>; // Part 4 §4: a race sets the body type and its innate perks and quirks
  achievements?: Record<string, AchievementDef>; // X6: awarded by code rules only
  zoneKinds?: Record<string, ZoneKind>; // Z2: every Weaver zone names one
  edgeKinds?: Record<string, EdgeKind>; // CO15
  barrierKinds?: Record<string, BarrierKind>; // SD3–SD5: what can stand on a way
  zoneSizes?: Record<string, ZoneSize>; // CO16
  roadLengths?: Record<string, RoadLength>; // TV3
  roadDangers?: Record<string, RoadDanger>; // TV4
  noiseLevels?: Record<string, NoiseLevel>;
  visibilityLevels?: Record<string, VisibilityLevel>;
  layouts?: Record<string, LayoutDef>; // CO17
  gearClasses?: Record<string, { id: string; name: string; skill: string; use: 'melee' | 'ranged' | 'improvised' | 'armor' | 'shield' }>; // GC…: the skill an item of the class asks for
  attackModes?: Record<string, { id: string; name: string; blend?: { weapon: number; ranged: number } }>; // attack modes by fixed ID (AM…); AttackMode.id names one
};

/** Z1–Z3: a zone is one open space with nothing in the way inside it, about a room across. A kind fixes
 * indoor or outdoor and gives the default cover and light, which the Weaver may change. */
export type ZoneKind = {
  id: string; name: string; outdoor: boolean; cover: import('./core').Cover; light: import('./core').Light;
  /** CO16 default size, and CO15 the edge kind every side gets unless the Weaver names another */
  size: import('../scales').ZoneSizeKey; edge: string;
  /** long side ÷ short side of the zone's rectangle (1 = square) */
  aspect: number;
  /** TV3 a road: one long zone whose length and danger the Weaver names (ROAD_LENGTHS, ROAD_DANGERS) */
  road?: true;
  /** NW4 a zone of this kind leads onward: besides the way in, it must link to another zone or a frontier (no dead-end streets) */
  onward?: true;
};
/** SD3–SD5: a kind of barrier on a way. lock / bar: whether one of this kind can carry a lock or a bar; blocked: it is a
 * blockage (rubble), shut until cleared; seeThrough: sight passes it while shut (a grate). The walls thread adds material. */
export type BarrierKind = { id: string; name: string; lock: boolean; bar: boolean; blocked: boolean; seeThrough: boolean; /** HB4 what sound loses crossing it */ sound: import('../scales').SoundLossKey; text: string };
/** CO17 a prebuilt layout: zones with keys local to it; links are [zone key, label, sight] */
export type LayoutDef = {
  id: string; name: string; building: string; entry: string;
  zones: { key: string; kind: string; name: string; look: string; size?: import('../scales').ZoneSizeKey; edges?: Partial<Record<import('./core').Side, string>>; links: [string, string, boolean][] }[];
};
/** CO15 what one side of a zone is: walk = cross it anywhere, see = see across, reach = strike or hand over across it, climb = cross it by climbing */
export type EdgeKind = { id: string; name: string; walk: boolean; see: boolean; reach: boolean; climb: boolean; /** HB4 what sound loses crossing it */ sound: import('../scales').SoundLossKey; text: string };
/** CO16 a zone size row: area in m² (CONFIG.ZONE_SIZE_M2) and what it is like, in the real world and in fantasy */
/** a NOISE level: its decibels at 1 m (CONFIG.NOISE_DB), a real reference, and how far it carries clearly and at all in the open in a quiet place (openAirReachM) */
export type NoiseLevel = { id: import('../scales').NoiseKey; name: string; decibels: number | null; like: string; clearTo: string; heardTo: string };
export type VisibilityLevel = { id: import('../scales').VisibilityKey; name: string; clearM: number | null; glimpsedM: number | null; like: string };
export type RoadLength = { id: import('../scales').RoadLengthKey; name: string; km: number };
export type RoadDanger = { id: import('../scales').RoadDangerKey; name: string; encounterPct: number };
export type ZoneSize = { id: import('../scales').ZoneSizeKey; name: string; m2: number; like: string };

/** Perk page S1–S9: a ladder perk sits on one milestone of one skill; trueSkill is its flat boost to
 * that skill (milestones 40/80/120); effect groups it in the "By effect" view. */
export type PerkEffect = 'attack' | 'defense' | 'health' | 'speed' | 'senses' | 'speech' | 'stealth';
/** opens `steps` more tiers past Critical Success (side 'up') or below Critical Failure ('down') on one kind of roll, or
 * on every kind ('any'), while the owner holds the perk or achievement (achievements: added up along the chain). A roll
 * that stops at the Critical tiers (the event roll) can then reach Critical Success+ and beyond, or Critical Failure−. */
export type TierUnlock = { roll: RollKind | 'any'; side: 'up' | 'down'; steps: number };
export type PerkDef = {
  id: string; name: string; text?: string; eventRoll?: number;
  tierUnlocks?: TierUnlock[];
  personality?: PersonalityAdd; // PL16: points added while owned
  /** MB21: moves a health fear's `from` level by `steps` (+ later, − sooner) */
  fearFrom?: { fear: string; steps: number };
  /** metres added to a thrown weapon's own range (CONFIG.THROW_M) */
  throwReach?: number;
  /** decibels quieter the owner still hears (RD4 Keen Ear 10: sharp, attentive ears against average ones) */
  hearingDb?: number;
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
  /** an All-XXX part (src/library/allPerks.ts): `skill` is the tree skill it belongs to; none = the tree's passive */
  allStep?: { treeId: string; step: 50 | 100 | 150; skill?: string };
  /** true skill added to every skill with this function (Hunter's Eye: +10 to the sight function) */
  fnSkill?: { fn: SkillFunction; add: number };
  /** a class-level perk (ClassDef.levelPerks): the class and level that grant it */
  classLevel?: { classId: string; level: number };
  /** improvement rolls a marked skill gets while its raw value is below `below` (Quick Study: 2 below 15) */
  improveRolls?: { below: number; rolls: number };
  freeLevels?: number; // free levels: this many level-ups that cost no XP, given while the perk is owned and active
  bonusLevels?: number; // bonus levels: this many character levels outside every class, given while the perk is owned and active
  /** while owned, skill `from` augments `skill` as a SkillDef.augments entry would (true skill × share × tier; its tree open) */
  augments?: { from: string; skill: string; share?: number; rollKinds?: import('./items').RollKind[] }[];
  /** true skill added to every aura skill (the skills the game's auras roll, src/library/auras.ts) */
  auraSkill?: number;
  /** a linked perk (src/library/perkLinks.ts): granted by owning a set of perks, never taken */
  linked?: true;
  /** D-218 event-roll variance: this many naturals just inside each critical range (however wide opened tiers make it) shift a tier outward */
  eventEdges?: number;
  /** D-218: the die lands this many times as far from the middle (50.5) for the margin; the natural edges read the real die */
  eventSpread?: number;
  /** D-218 active ability of a Threadbound item: fires by itself on the owner's next essence quality roll once its cooldown
   * (game minutes) has passed. 'farther': roll twice, keep the die farther from the middle; 'all_or_nothing': 51–100 is
   * Critical Success, 1–50 Critical Failure */
  essenceAuto?: { kind: 'farther' | 'all_or_nothing'; cooldownMin: number };
  /** TB7: owning it gives a random Threadbound item not yet in the world, of at least this Rank (TB11), bound to the
   * owner and worn (once) */
  grantsThreadboundItem?: { minRank: import('../scales').ThreadboundRankKey };
};
/** a 40/80/120 perk's numbers; each applies only to rolls of the perk's own ladder skill */
export type BoostNumbers = { aimMult?: number; damageMult?: number; armorPierce?: number; recoveryMult?: number; hitAdd?: number; rollAdd?: number };
export type PerkRules = { kind: string; trigger: string; conditions: string[]; effect: string; lasts: string; cooldown?: string; needs?: string; open?: string };
/** a chosen or banked perk write-up (src/library/perks.ts): ref is its review-page id; place is where it sits for now */
/** What a write-up with no ladder yet is kept for: a later milestone perk of its own skill, an All-X candidate
 * (All-100/150 of the skill's tree), or something else. `aimAt` is the suggested milestone (60/100/140) or All tier (100/150). */
export type BankedAs = 'milestone' | 'allX' | 'other';
export type PerkWriteup = PerkDef & { ref: string; skill: string; place: '20' | '40' | 'higher' | 'very_high' | 'banked' | 'all50' | 'linked'; story: string; rules: PerkRules;
  bankedAs?: BankedAs; aimAt?: number };

/** X6/X11: a library achievement, keyed by its fixed id (ACH in src/library/achievementIds.ts), with a name. 'defeats' is earned at `count`
 * defeats (first defeat = count 1). With `by`, it is earned once per body type or race: the granted id is
 * <id>:<type or race> and {body_type}/{race} in the name become what was defeated. 'mastery' once per tree when all three
 * of its skills reach `count` (50/100/150), id <id>:<tree>. */
/** How long an action takes on the game clock (T1). `orders` lists the order types the row covers;
 * the action row (DU in src/library/tableIds.ts) is the default; the fight turn row is every turn of a fight; the sleep row is one sleep. */
export type DurationDef = { id: string; name: string; minutes: number; orders?: string[] };

/** A healing source (H1/H12): what it restores, the worst part state it can heal (`reach`, a
 * PART_STATES key), whether it works in a fight, and what it needs (a place kind; an item names its source with
 * ItemDef.heal). `hourly` makes it passive: per game hour it restores skill × pctPerPoint % (H12). */
export type HealingDef = {
  id: string; name: string; hpPct: number; partPct: number; reach: PartStateKey; inFight: boolean; placeKinds?: string[];
  /** heals a Dead actor (no for every row for now; a lever for resurrection later) */
  revivesDead: boolean;
  /** the composure-table row the same action also restores (rest, clinic): morale comes from that table, not this one */
  composure?: string;
  hourly?: { skill: string; pctPerPoint: number };
  /** never applied itself: a source achievements count healing under (HL.perk: healing from perks) */
  countOnly?: true;
};

/** A composure source: what restores morale (MB8/MB9/MB34), the morale twin of a healing row. `pct` = share of max morale
 * restored; `hourly` makes it passive (per game hour, skill × pctPerPoint %). A healing row names the composure row its
 * action also restores (HealingDef.composure), so rest restores both while each table tunes on its own. */
export type ComposureDef = {
  id: string; name: string; pct: number; inFight: boolean;
  hourly?: { skill: string; pctPerPoint: number };
  /** never applied itself: a source achievements count restored morale under (CP.perk: morale from perks) */
  countOnly?: true;
};

/** MB21–MB28: something that costs morale (a negative cost restores it). `rolled`: the morale roll's tier scales the cost
 * (MORALE_TIER_MULT); otherwise it is flat (× `perTier` the contest's tier gap for a lost speech roll).
 * `health`: the HEALTH_LEVELS keys that set it off; perks and achievements move `from` with fearFrom. */
/** part: a PART_STATES key; the fear fires when one of the actor's body parts reaches that state or worse from a better one.
 * partCost: its cost per part by the part's impact, for a body of refParts parts; a body with more parts pays less per part
 * (cost × refParts ÷ the body's part count). One roll per hit pays the sum for every part the hit took there. */
export type FearDef = { id: string; name: string; cost: number; rolled: boolean; perTier?: boolean; health?: { from: HealthLevelKey; to: HealthLevelKey }; part?: PartStateKey;
  partCost?: Record<ImpactId, number>; refParts?: number;
  /** reads another part fear's partCost and refParts by reference, × mult, so editing that row changes this one too */
  partCostOf?: { fear: string; mult: number } };

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
  /** AG4: the age in years at which each life stage starts; left out = ageless (Slime) */
  ageStages?: Partial<Record<import('../scales').LifeStageKey, number>>;
};

/** level: a REWARD_LEVELS key; its XP is CONFIG.REWARD_XP[level].
 * after: the key of the lower level this one builds on. Earning it switches the lower level off,
 * and its Bane bonus is the lower level's bonus plus its own. */
/** what an achievement counts (unordered: names are the ids); its text lives in ACH_RULE_TEXT (achievementIds.ts) */
export type AchievementRule = 'defeats' | 'mastery' | 'unaware_defeats' | 'yielded' | 'crits' | 'beyond_crit' | 'crippled_defeats' | 'zones' | 'deals' | 'days'
  | 'class_unlock' | 'flawless' | 'outnumbered' | 'brink' | 'class_max' | 'class_max_tiers' | 'char_level' | 'held_line' | 'quests_done' | 'quests_abandoned'
  | 'clean_defense' | 'unseen_moves' | 'vanished' | 'spotted' | 'speech_won' | 'talked_down' | 'outmatched' | 'enemy_to_friend' | 'won_without_blow'
  | 'coin_spent' | 'coin_earned' | 'mended' | 'back_from_down' | 'holds' | 'aimed_hits'
  | 'quests_for_giver' | 'quest_givers' | 'quest_chains' | 'quests_early' | 'quests_unpaid' | 'spar_wins' | 'cruel_spar_wins' | 'spar_losses' | 'achievements' | 'defeated'
  | 'won_panicking' | 'morale_breaks' | 'healed' | 'calmed' | 'hp_lost' | 'morale_lost' | 'survived_above' | 'survived_above_pct' | 'won_above' | 'won_above_pct' | 'event_crits' | 'event_crit_fails'
  | 'essences_taken' | 'essence_room';
/** what a per-kind achievement is earned once for: the granted id is <id>:<that kind's id> */
export type AchievementBy = 'body_type' | 'race' | 'group' | 'class' | 'class_tier' | 'function' | 'skill' | 'size' | 'giver' | 'heal_source' | 'morale_source';
/** scar: a negative achievement, listed under Scars instead of Achievements */
/** an achievement tag: a key of ACH_TAGS in src/library/achievementIds.ts */
export type AchievementTag = 'combat' | 'stealth' | 'social' | 'exploration' | 'survival' | 'skill' | 'progression';
/** a reward field of AchievementDef */
export type AchievementReward = 'perk' | 'unawareShift' | 'quieter' | 'readsHealth' | 'skillAdd' | 'renown' | 'deathsDoor' | 'firstSight'
  | 'standIn' | 'reqLower' | 'pricePct' | 'rally' | 'restPct' | 'eventRoll' | 'freeLevels' | 'bonusLevels' | 'personality' | 'personalityByKind' | 'tierUnlocks';
export type AchievementDef = { id: string; name: string; level: string; rule: AchievementRule; tags: AchievementTag[]; count?: number; by?: AchievementBy; after?: string; scar?: true;
  /** rewards beyond XP (src/ruleset/achRewards.ts). A level also gives every reward of the lower levels of its chain,
   * read from their rows; `excludes` names inherited rewards this level drops */
  perk?: string; // granted when earned, kept for good
  fearFrom?: { fear: string; steps: number }; // MB21: as PerkDef.fearFrom
  unawareShift?: number; // tier steps up on attacks against a target unaware of the owner
  quieter?: number; // the owner's moves are this many steps quieter on the noise scale
  readsHealth?: true; // the owner sees the health level of every member of the achievement's body type or race
  skillAdd?: Record<string, number>; // true skill added to these skills
  personality?: PersonalityAdd; // PL15: Nerve or trait points added while current
  /** AP12: extra points while current, only when earned for this kind (`of`, e.g. a skill id on a by-skill row): Lying wins add Honesty −1 step */
  personalityByKind?: Record<string, PersonalityAdd>;
  renown?: number; // every foe fighting the owner takes this much off its morale rolls (MB24)
  deathsDoor?: number; // a charge: a hit that would take the owner Down leaves them at Critical; refills after this many game days
  excludes?: AchievementReward[]; // lower levels' rewards this level does not carry up
  standIn?: number; // + this share for stand-ins on rolls of a skill in the achievement's group
  reqLower?: number; // equip requirements on the achievement's tree's skills ask this much less of the owner (the gear's own numbers stay)
  pricePct?: number; // + this % off the owner's buying prices
  rally?: number; // allies fighting beside the owner get + this on their morale rolls
  restPct?: number; // + this % HP and part healing on each rest
  eventRoll?: number; // + this on the owner's event rolls
  tierUnlocks?: TierUnlock[];
  freeLevels?: number; // free levels: this many level-ups that cost no XP (taken like any level, src/engine/xp.ts spendXp)
  bonusLevels?: number; // bonus levels: this many character levels that no class gets (perk points on even levels; no class perks)
  firstSight?: IntelligenceKey; // members of the achievement's race or body type, up to this intelligence, meet the owner opposed instead of hostile
  /** reward levels added for some kinds of `by` (a part size: smaller parts pay more), e.g. { small: 1 } */
  levelUp?: Partial<Record<string, number>>;
  /** with `by`: counts only this kind (e.g. one healing row), instead of each kind on its own */
  only?: string;
  /** earned again at every multiple of this count (granted as `<id>:<n>`), instead of once */
  every?: number;
  /** with `every`: each later earning is this many reward levels higher than the one before (capped at the top) */
  levelStep?: number;
  /** a name of its own for each earning, by what it is earned for (an every-N row: the level); others use `name` */
  names?: Record<string, string> };
