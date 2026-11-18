// Library content shapes (Part 1 §3 skills, Part 3 body type database, Part 4 classes/templates, Part 5 items, routine bank).
import type { LibraryRef } from './core';
import type { IntelligenceKey } from '../scales';
import type { AttackMode, ItemDef, RollKind } from './items';
import type { NpcTemplate } from './actor';
import type { ActivityDef, Routine, RoutineSet } from './hidden';
import type { EntryStatus } from './state';
import type { FN, GR } from '../library/functionIds';
import type { GrandeurKey, HealthLevelKey, PartStateKey, Past100Key, SkillTierKey } from '../scales';

/** F1–F8: a skill lists one or more narrow functions; stand-ins read them. Each function belongs to one
 * broad group (FUNCTION_GROUP, src/library/functionNames.ts); the 40 perk's +1 and the XP category read the group. */
export type SkillFunction = (typeof FN)[keyof typeof FN]; // fixed IDs: src/library/functionIds.ts
export type SkillGroup = (typeof GR)[keyof typeof GR];
/** the kind of an attack, by its mode: 'ranged' = a ranged-tree mode (shots and throws), 'melee' = every other (melee and unarmed, natural attacks included) */
export type AttackKind = 'melee' | 'ranged';
/** Situation tags (ST21): a situational table (CONFIG.SITUATION_TAGS) affects a roll whose skill has its tag. */
export type SituationTag = 'sight' | 'hearing' | 'stealth' | 'hide' | 'ranged';
export type RoleId = (typeof import('../library/tableIds').RL)[keyof typeof import('../library/tableIds').RL];
export type SizeId = 'tiny' | 'extra_small' | 'small' | 'normal' | 'big';
export type ImpactId = 'non_essential' | 'normal' | 'essential';

/** D-276: how an augment adds (ruleset/gear.ts augmentK, the one equation). plain (the default): the giving skill's true
 * skill × share (default 1). trade: the same with share default CONFIG.AUGMENT_TRADE_SHARE, and the giving skill's own rolls
 * lose what it gives (points moved, never made; always on). percent: the giving skill's true skill ÷ 100 × share (the rate,
 * default CONFIG.AUGMENT_PERCENT_RATE) × the receiving skill's own true skill; several on one skill add in full (RN3 c). */
export type AugmentKind = 'plain' | 'trade' | 'percent';
/** a situation an augment needs on the roll (RollRequest.when): from_hiding, an attack made while stealthy (CN6 Patient Knife) */
export type AugmentWhen = 'from_hiding';

export type SkillDef = {
  id: string;
  treeId: string;
  functions: SkillFunction[];
  groups?: SkillGroup[]; // groups the skill joins directly, without that group's function (Dodge: Speed)
  /** skills this skill augments: its effective value × share is added to every roll that asks for that skill,
   * or only rolls of the listed kinds (none listed: every roll and check of that skill); kind as AugmentKind */
  augments?: { skill: string; share?: number; kind?: AugmentKind; rollKinds?: import('./items').RollKind[] }[];
  roles: RoleId[]; // body-part roles the skill uses (wounds reach a roll through these)
  cue?: 'sight' | 'sound'; // Notice skills: which cue they read (Scent reads smell through its own function)
  tier: SkillTierKey; // final efficiency multiplier (CONFIG.SKILL_TIER_MULT)
  tags?: SituationTag[]; // situation tags (ST21): which situational tables reach its rolls
  access?: TreeAccess; // a skill's own rule on top of its tree's (SR1: persuasion and barter need a speaking race)
};
/** One access condition: a source that opens or blocks a skill tree (TA1–TA11). 'class': the actor has that class, Current
 * or Previous, at `level` or more (default 1, TA3); 'perk': the actor owns that perk or quirk; 'raceTag': the actor's race
 * carries that tag (RaceDef.tags), e.g. 'speaks'. Count kinds read `level` as the count: 'classes' = classes on the sheet in
 * any state (id unused); 'allStep' = trees whose All-XXX at step `id` (e.g. '50') the actor has; 'skillsAbove' = skills
 * whose true skill is above `id`. */
export type AccessCond = { kind: 'race' | 'raceTag' | 'body' | 'class' | 'perk' | 'skill' | 'classes' | 'allStep' | 'skillsAbove'; id: string; level?: number };
/** TA1/TA2: a tree opens when every `must` holds and, if `either` is listed, at least one of those; any `blockedBy`
 * closes it, and a block always wins. No access rule: open to everyone. */
export type TreeAccess = { must?: AccessCond[]; either?: AccessCond[]; blockedBy?: AccessCond[] };
export type TreeDef = { id: string; name: string; skills: string[]; access?: TreeAccess;
  /** TREE_RATINGS key (default normal): how many skills at a step earn the tree's All-XXX (CONFIG.ALL_STEP_SKILLS) */
  rating?: import('../scales').TreeRatingKey };
/** NG2: which skills a role or theme raises, by band (a share of the rank's anchor, CONFIG.ROLE_BAND_SHARE) */
export type SkillBands = { high?: readonly LibraryRef[]; moderate?: readonly LibraryRef[]; low?: readonly LibraryRef[] };
/** NG14: personality a layer leans toward: a Nerve, trait points (PA…) and values (VL…, strongest first); a later layer wins per axis */
export type PersonalityLean = { nerve?: number; traits?: Record<LibraryRef, number>; values?: readonly LibraryRef[] };
/** NG1: an NPC role (RO): the skills its work trains; nothing else rises (NG8). kind sets its rank floor (NG13: combat
 * CONFIG.RANK_FLOOR.combat, civilian .civilian; a beast has none and no personality spread). traits: its rank-trait pool (NG12) */
export type NpcRoleDef = { id: LibraryRef; name: string; kind: 'combat' | 'civilian' | 'beast'; bands: SkillBands;
  /** NR40: how grand the role is (GRANDEUR); it moves the level read from an NPC's skills */
  grandeur: GrandeurKey; leans?: PersonalityLean; traits?: readonly LibraryRef[];
  /** NG10: the gear classes (GC…) its work uses; spawn picks the best item of each its skill meets, up to its theme's wealth */
  gear?: readonly LibraryRef[] };
/** NR37: a beast prefix: its name in a label (a dire wolf), the rank steps it adds to the sheet, and its health multiplier */
export type PrefixDef = { id: LibraryRef; name: string; text: string; rankStep: number; hpMult: number; /** NR46: every banded skill × this, after the rank step */ skillMult?: number };
/** NR17: a kind of hook: what the person gives play, who can fill it (roles, or a group), and its rank kind (CONFIG.ROSTER_RANKS) */
export type HookKindDef = { id: LibraryRef; name: string; gives: string; roles?: readonly LibraryRef[]; groups?: readonly LibraryRef[]; theme?: LibraryRef; class?: LibraryRef;
  rank: 'face' | 'lead' | 'threat' | 'seat'; goals?: true };
/** NR27: one part of a group: its role (or a template), race when fixed (else rolled: NR31), label, and rank steps above the group's */
export type GroupPart = { role?: LibraryRef; roles?: readonly LibraryRef[]; template?: LibraryRef; race?: LibraryRef; label: string; step?: number; class?: LibraryRef };
/** NR27 (D-308): a group recipe: a leader and its followers, of one theme */
export type GroupDef = { id: LibraryRef; name: string; theme: LibraryRef; lead: GroupPart; follow?: GroupPart & { count: [number, number] } };
/** NR18 to NR20: a group that may be met, its weight, and the time of day it is out (both when left out) */
export type MeetRow = { group: LibraryRef; weight: number; when?: 'day' | 'night' };
/** NG1: an NPC theme (TH): skills its world adds, its personality lean (NG14), its rank-trait pool (NG12) and its own rank
 * titles (display only) */
export type ThemeDef = { id: LibraryRef; name: string; bands?: SkillBands; leans?: PersonalityLean; traits?: readonly LibraryRef[];
  /** NR40: how grand its people are; an NPC takes the higher of its role's and its theme's */
  grandeur: GrandeurKey;
  /** the role kinds that fit this world (NpcRoleDef.kind): a road bandit or a watchman fights, a wild beast is a beast; compose refuses others */
  roleKinds: readonly NpcRoleDef['kind'][];
  /** NG10: the highest equip level its people's gear reaches (an EQUIP_LEVELS key); none = no picked gear */
  wealth?: import('../scales').EquipLevelKey; rankNames?: Partial<Record<import('../scales').RankKey, string>>; talent?: import('../scales').TalentKey /* AG25: its presets' talent when they name none */ };

/** skill id → bound (a number, or a Past100Key: 'beyond', 'mythic', 'transcendent', 'divine') */
export type EssenceBounds = Record<string, number | Past100Key>;
/** growth proposal 2.2: an essence row. A beaten foe of its race or body type, or a scenario's deeds, can offer it; its points
 * are true skill split over `skills` by weight; a deed row (deed: true) puts its points on the scenario's most-marked skill */
export type EssenceDef = {
  id: string; name: string;
  /** echo: one echo's own essence, on its template's hand-set list only (EN3 b), never on a worked-out list; role: only NPCs
   * of that role (RO id); over: only when that skill is above every skill in the role's high band (a beast's weapons);
   * min / max: only when each named skill of the owner (raw × tier) is at least / at most that value, a number or a step of
   * the ladder past 100 ('beyond' 150 … 'divine' 400), so a row can be kept for Divine owners or kept from them */
  from: { race?: string; bodyType?: string; role?: string; over?: string; min?: EssenceBounds; max?: EssenceBounds; deed?: true; echo?: true };
  skills: { skill: string; weight: number }[];
  trait?: string; quirk?: string; // perk rows (OwnedPerk source 'essence'); one so far, Tavern Brawler's Fists Do the Talking (a placeholder; content round D-229)
  story: string;
};
/** PY3: a service a seller can offer; heals names the healing row it pays for */
export type ServiceDef = { id: string; name: string; price: number; heals?: string };
/** DX1: a Start, one way to begin on the creation screen (ST…). classId: the class it begins in; left out, the class
 * comes from what the start gives (a blessing start: its god's class). points and level: left out = CONFIG.CREATION_POINTS /
 * START_LEVEL; level is the start class's level. age: the age picker's default (AG15). story: shown on the creation screen
 * (left out = the class's). blessing: begins with a random god's blessing of this tier (BLESSING_TIERS) */
export type StartDef = {
  id: string; name: string; classId?: string; points?: number; level?: number; age?: number; story?: string;
  blessing?: { tier: import('../scales').BlessingTierKey };
};
/** DX1: a god. rank: its standing (GOD_RANKS); field: the narrow thing it governs */
export type GodDef = { id: string; name: string; rank: import('../scales').GodRankKey; field: string };
export type ClassDef = {
  id: string; name: string; floors: Record<string, number>;
  personality?: PersonalityAdd; // PL16: points added while it is the current class
  /** the class's tier (CLASS_TIERS key): how strong it is next to other classes */
  tier: import('../scales').ClassTierKey;
  /** the public stranger label a player starting in this class has */
  label?: string;
  /** flavor text shown with the class; its grandeur grows with the class's tier */
  story?: string;
  /** DX1: the god whose blessing unlocks this class (a variant per god); a blessed start begins in it */
  blessedBy?: import('../library/godIds').GodId;
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
  /** other ways in: the class also unlocks when every rule of any one of these holds (Knight: Knight Trainee at its top level) */
  orUnlocks?: { unlock?: Record<string, number>; unlockAny?: Record<string, number>[]; unlockClass?: Record<string, number | 'max'> }[];
  /** the default class: unlocked for a player whose current class reaches its top level, so banked XP has somewhere to go */
  fallback?: true;
  /** alternate capstones: each can replace the default capstone when its conditions hold as the class reaches its
   * top level (Must / Either of / Blocked by, as in tree access) */
  capstones?: { perk: string; needs: TreeAccess }[];
};

/** reachM (grip parts): how far the part reaches to take or hand over something, metres from the body (FR2); arm: an arm,
 * whose reach comes from the body's size instead (SZ8, library/bodySize armReachM) */
export type PartDef = { id: string; size: SizeId; impact: ImpactId; roles: RoleId[]; adjacent?: string[]; reachM?: number; arm?: true };
/** AB20: natural armor stops ARMOR_FACTOR × the owner's Hide skill × `hide` (the race's multiplier), then multiplies as worn armor */
export type NaturalArmor = { covers: string[]; hide: number; multiplier: number; pools?: Record<string, number> };
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
  /** FT12: × the sleep debt each hour awake adds (left out = 1; 0 = never needs sleep, still feels strain) */
  sleepNeed?: number;
  /** optional body figure for the sheet: an SVG path per part id ('general' for the general area) */
  figure?: { viewBox: string; parts: Record<string, string> };
  /** SZ1–SZ3: the shape's usual size in metres (a race multiplies it, RaceDef.sizeMult): length nose to rump (head and body,
   * no tail), width at the widest point, height standing (stature upright, shoulder height for beasts). Left out (a story's own body type) = the Humanoid's */
  size?: BodySize;
};
/** SZ2: a body's length, width and height in metres */
export type BodySize = { lengthM: number; widthM: number; heightM: number };

/** PL6: one personality axis; `low` and `high` are the words for its two ends, each with a short behaviour hint */
export type PersonalityAxisDef = { id: string; name: string; low: string; high: string; lowHint: string; highHint: string };
/** PL10: an archetype, a whole-person target: points on the axes (PA…, left out = 0) and Nerve (left out = 0), and the
 * values (VL…) the type lives by. A character's archetype is the nearest row (src/ruleset/personality.ts archetypeOf). */
export type PersonalityTypeDef = { id: string; name: string; target: Record<string, number>; nerve?: number; values?: string[]; hint: string };
/** a tension: two parts of a character that pull against each other; every condition given must hold. min/max keys: an
 * axis (PA…), raw Resolve (SK.resolve), or bestSkill, bestFight, bestAttack (the best raw skill of any kind, of a fighting
 * group, of an attacking group). `drives`: every one of these values is held; `anyDrive`: at least one is */
export type TensionDef = { id: string; name: string; hint: string; when: { min?: Record<string, number>; max?: Record<string, number>;
  nerveLine?: import('../scales').NerveLine; ageStage?: import('../scales').LifeStageKey; drives?: string[]; anyDrive?: string[] } };
/** PL15, PL16: points a perk, class or achievement adds while held, by 'nerve' or personality axis (PA…) */
export type PersonalityAdd = Record<string, number>;

export type Library = {
  version: number;
  status: Record<string, EntryStatus>;
  skills: Record<string, SkillDef>;
  trees: Record<string, TreeDef>;
  classes: Record<string, ClassDef>;
  starts: Record<string, StartDef>; // DX1: ST…, the ways to begin on the creation screen
  gods?: Record<string, GodDef>; // DX1: GD…, the gods; each has a narrow field (beings above them govern wider ones)
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
  recovery?: Record<string, RecoveryDef>; // FT7: what restores stamina, beside healing and composure
  fears?: Record<string, FearDef>; // MB21: what costs morale
  personalityAxes?: Record<string, PersonalityAxisDef>; // PL6: PA…
  values?: Record<string, { id: string; name: string; hint: string }>; // PL19: VL…, what a character cares about
  personalityTypes?: Record<string, PersonalityTypeDef>; // PL10: PY…, archetypes; the nearest is the character's
  tensions?: Record<string, TensionDef>; // TN…, shown in row order
  essences?: Record<string, EssenceDef>; // growth proposal: ES…, packages a beaten foe or a scenario's deeds can offer
  npcRoles?: Record<string, NpcRoleDef>; // NG1: RO…, what an NPC does for a living
  themes?: Record<string, ThemeDef>; // NG1: TH…, the world an NPC belongs to
  prefixes?: Record<string, PrefixDef>; // NR37: PF…, beast prefixes
  hookKinds?: Record<string, HookKindDef>; // NR17: HK…, why a real person stands in a place
  groups?: Record<string, GroupDef>; // NR27 (D-308): GP…, cast as one entry
  /** NR17: the hooks each settlement size holds; code rolls them per site, the World builder fills them */
  rosters?: Record<'hamlet' | 'village' | 'town' | 'city' | 'court', { count: [number, number]; must: LibraryRef[]; pool: LibraryRef[]; theme: LibraryRef }>;
  /** NR18: who travels a road, by its danger: how many groups a stretch holds, and from which rows */
  roadPeople?: Record<string, { count: [number, number]; rows: MeetRow[] }>;
  wildPeople?: Record<string, MeetRow[]>; // NR19: by land cover (LC…), who can be met for danger or gain
  landmarkPeople?: Record<string, MeetRow[]>; // NR20: by landmark kind (LM…), who works or lives there
  services?: Record<string, ServiceDef>; // PY3: services sellers offer, by fixed ID (SV…)
  durations?: Record<string, DurationDef>; // T1: how long each action takes on the game clock
  races?: Record<string, RaceDef>; // Part 4 §4: a race sets the body type and its innate perks and quirks
  achievements?: Record<string, AchievementDef>; // X6: awarded by code rules only
  zoneKinds?: Record<string, ZoneKind>; // Z2: every Weaver zone names one
  wallKinds?: Record<string, WallKind>; // PZ2: WK…
  openingKinds?: Record<string, OpeningKind>; // PZ2: OP…
  lightKinds?: Record<string, LightKind>; // PZ5: LK…
  furnitureKinds?: Record<string, FurnitureKind>; // FR1
  barrierKinds?: Record<string, BarrierKind>; // SD3–SD5: what can stand on a way
  barrierMaterials?: Record<string, BarrierMaterial>; // BW24: what walls, barriers and rubble are made of, and how long they take to break
  zoneSizes?: Record<string, ZoneSize>; // CO16
  roadLengths?: Record<string, RoadLength>; // TV3
  roadDangers?: Record<string, RoadDanger>; // TV4
  regionKinds?: Record<string, RegionKind>; // WZ11: RK…
  landCovers?: Record<string, LandCover>; // WZ1: LC…
  landmarkKinds?: Record<string, { id: string; name: string; seek: string }>; // WZ2: LM…, seek is a WHERE word (src/land)
  noiseLevels?: Record<string, NoiseLevel>;
  visibilityLevels?: Record<string, VisibilityLevel>;
  layouts?: Record<string, LayoutDef>; // CO17
  itemFamilies?: Record<string, { id: string; name: string; rule: string }>; // IF…: Mundane and the special families (IR30)
  gearTypes?: Record<string, { id: string; name: string; reachM?: number; lengthM?: number; covers?: string[] }>; // GT…: a gear type's reach, length past the hand (SZ8) or coverage (IR23)
  gearClasses?: Record<string, { id: string; name: string; skill: string; use: 'melee' | 'ranged' | 'improvised' | 'armor' | 'shield' | 'unarmed' }>; // GC…: the skill an item of the class asks for
  attackModes?: Record<string, { id: string; name: string; blend?: { weapon: number; ranged: number } }>; // attack modes by fixed ID (AM…); AttackMode.id names one
};

/** PZ14 a: a title kind is a drawing template: how code draws a title of this kind. roof: a roof goes over it (indoors);
 * wall: the wall kind (WK) each side gets unless the Weaver or a layout names another (none: no wall); light: the light word
 * it is drawn lit to (a source at its middle, PZ5); size and aspect: its footprint. */
export type ZoneKind = {
  id: string; name: string; roof: boolean; light: import('./core').Light;
  size: import('../scales').ZoneSizeKey; wall: string;
  /** FR2: furniture every title of this kind gets unless a layout or the Weaver gives its own */
  furniture?: PlanFurniture[];
  /** long side ÷ short side of its footprint (1 = square) */
  aspect: number;
  /** NW4 a title of this kind leads onward: besides the way in, it must have another way or a frontier (no dead-end streets) */
  onward?: true;
};
/** PZ2: a kind of wall: walk = walked across, see = seen through, reach = struck or handed over across it, climb = crossed by
 * climbing; heightM: how high it stands above its floor (none: a storey); sound: what a sound loses crossing it (HB4); none:
 * an open side, drawn as no wall at all */
export type WallKind = { id: string; name: string; walk: boolean; see: boolean; reach: boolean; climb: boolean; sound: import('../scales').SoundLossKey; heightM?: number; none?: true; text: string;
  /** BW26: the material (barrierMaterials, BM) a wall of this kind is made of when it names none, read at that material's example thickness */ material?: string };
/** BW24: a material walls, barriers and rubble are made of (library barrierMaterials, BM). thicknessCm: its real range;
 * exampleCm: the thickness secondsAt50 is for; secondsAt50: a working professional with the right tool breaking a
 * person-sized hole through exampleCm of it (BW8: from the cited source; time grows with thickness); noise: each blow (BW10);
 * trait: regrows (work left idle is lost, BW9) or deeper (harder deeper in the wild, waits on D-331); source: where the time comes from */
export type BarrierMaterial = { id: string; name: string; thicknessCm: [number, number]; exampleCm: number; secondsAt50: number; noise: import('../scales').NoiseKey; trait?: 'regrows' | 'deeper'; fantasy?: true; source: string; text: string };
/** PZ2: a kind of way: a doorway, gap, window or stairs. seeThrough: the far side shows (with no barrier shut in it); walk:
 * walked through (a window is only jumped down, SD7); floors: it joins two floors (stairs, a ladder, a hatch); sizeM:
 * [width, height] when no barrier gives one (none: as wide as the ground the two titles share); sillM: a window's sill */
export type OpeningKind = { id: string; name: string; seeThrough: boolean; walk: boolean; floors?: true; sizeM?: [number, number]; sillM?: number; text: string };
/** PZ5 a: a kind of light source and its brightness in candela (placeholders); scaled: its brightness is set per source
 * (a title's lights, drawn bright enough for its light word) */
export type LightKind = { id: string; name: string; candela: number; scaled?: true; like: string };
/** SD3–SD5: a kind of barrier on a way. lock / bar: whether one of this kind can carry a lock or a bar; blocked: it is a
 * blockage (rubble), shut until cleared; seeThrough: sight passes it while shut (a grate). The walls thread adds material. */
export type BarrierKind = { id: string; name: string; lock: boolean; bar: boolean; blocked: boolean; seeThrough: boolean; /** HB4 what sound loses crossing it */ sound: import('../scales').SoundLossKey; text: string;
  /** SZ7: the opening in metres, [width, height] (a hatch: [width, length], walked through upright) */ openingM?: [number, number]; vertical?: true;
  /** PC3: a window's shutters: it goes only on a drop (seen, shot and jumped through, never walked); sillM = how high its sill stands above the inside floor */ window?: true; sillM?: number;
  /** PC4: nothing to open or shut (an arrow slit, bars): it stays as it is until broken */ fixed?: true;
  /** BW24: what it is made of when the barrier names no material (barrierMaterials, BM), read at that material's example thickness */ material?: string };
/** FR1/FR2: furniture as a layout, a zone kind or the Weaver writes it: a kind from catalogs.furnitureKinds, its name, where it stands */
export type PlanFurniture = { kind: string; name: string; at?: string; edge?: boolean; grade?: import('./core').Grade };
/** PC1: sizeM = [length, width, height] in metres (placeholders): it hides what is behind it (ruleset/objectCover) */
export type FurnitureKind = { id: string; name: string; sizeM?: [number, number, number] };
/** CO17, PZ14 a: a prebuilt layout, a small floor plan: titles with keys local to it, the wall kind of any side that differs
 * from the kind's (walls), and its ways: [title key, label, way kind] (WAY_KINDS: open, door, window, up, down) */
export type LayoutDef = {
  id: string; name: string; building: string; entry: string;
  zones: { key: string; kind: string; name: string; look: string; size?: import('../scales').ZoneSizeKey; walls?: Partial<Record<import('./core').Side, string>>; ways: [string, string, import('./core').WayKind][]; furniture?: PlanFurniture[] }[];
};
/** a NOISE level: its decibels at 1 m (CONFIG.NOISE_DB), a real reference, and how far it carries clearly and at all in the open in a quiet place (openAirReachM) */
export type NoiseLevel = { id: import('../scales').NoiseKey; name: string; decibels: number | null; like: string; clearTo: string; heardTo: string };
export type VisibilityLevel = { id: import('../scales').VisibilityKey; name: string; clearM: number | null; glimpsedM: number | null; like: string };
export type RoadLength = { id: import('../scales').RoadLengthKey; name: string; km: number };
/** WZ11 a region kind: how code draws its land. Shares are of the region's wild land (not farmed or settled), by land
 * cover id; relief is the lowest and highest ground in metres; a river crosses it when `river` is set */
export type RegionKind = {
  id: string; name: string; text: string;
  relief: [number, number]; rough: number; river?: { width: number; like: string }; streams: number;
  wild: Record<string, number>; open: string;
  settlements: { town: number; village: [number, number]; hamlet: [number, number] };
  danger: import('../scales').RoadDangerKey;
};
/** WZ1 a land cover: its cover for those standing in it, how high it stands (it blocks sight over it: trees, houses) */
export type LandCover = { id: string; name: string; cover: import('./core').Cover; standsM: number; like: string };
export type RoadDanger = { id: import('../scales').RoadDangerKey; name: string; encounterPct: number };
/** CO16 a zone size row: area in m² (CONFIG.ZONE_SIZE_M2) and what it is like, in the real world and in fantasy */
export type ZoneSize = { id: import('../scales').ZoneSizeKey; name: string; m2: number; like: string };

/** Perk page S1–S9: a ladder perk sits on one milestone of one skill; trueSkill is its flat boost to
 * that skill (milestones 40/80/120); effect names what kind of thing it does. */
export type PerkEffect = 'attack' | 'defense' | 'health' | 'speed' | 'senses' | 'speech' | 'stealth';
/** opens `steps` more tiers past Critical Success (side 'up') or below Critical Failure ('down') on one kind of roll, or
 * on every kind ('any'), while the owner holds the perk or achievement (achievements: added up along the chain). A roll
 * that stops at the Critical tiers (the event roll) can then reach Critical Success+ and beyond, or Critical Failure−. Roll
 * 'contest': every roll the owner makes as one side of a contest (RollRequest.contest). */
export type TierUnlock = { roll: RollKind | 'any' | 'contest'; side: 'up' | 'down'; steps: number };
export type PerkDef = {
  id: string; name: string; text?: string; eventRoll?: number;
  tierUnlocks?: TierUnlock[];
  personality?: PersonalityAdd; // PL16: points added while owned
  /** SS14: multipliers on how fast hours awake add sleep debt (sleepNeed) and how fast sleep clears it (sleepClear); several
   * multiply together in full (RN5 c; perkSleepMult in src/ruleset/fatigue.ts) */
  sleepNeed?: number; sleepClear?: number;
  /** SS12: tags a template's quirkTags pick from (Heavy Sleeper and Insomniac: 'sleep') */
  tags?: string[];
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
  /** the skills a ladder perk's `numbers` work with (Keen Edge: every melee weapon skill); none = the perk's own skill */
  numbersFor?: string[];
  /** the kind of attack its numbers work with instead of skills: 'melee' (melee and unarmed attacks, natural ones included)
   * or 'ranged' (shots and throws), whatever skill rolls it; wins over numbersFor */
  numbersForAttack?: AttackKind;
  /** SH1/SH4: 120 perks: a share of the ladder skill's true skill (read without shares) added as true skill, to the ladder skill
   * itself (shareOwn) and to it and every skill sharing a group with it (shareGroup); several shares on one skill stack (SH7 b) */
  shareOwn?: number; shareGroup?: number;
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
  /** DX1: a god's blessing: which god gives it and at what tier (BLESSING_TIERS) */
  blessing?: { god: import('../library/godIds').GodId; tier: import('../scales').BlessingTierKey };
  /** dreaded on sight (src/engine/auras.ts sightDread): whoever sees the owner for the first time pays fear row `fear`, and from
   * then on its stance toward the owner reads `colder` steps colder until play gives it a stance of its own */
  onSight?: { colder: number; fear: string };
  /** an All-XXX part (src/library/allPerks.ts): `skill` is the tree skill it belongs to; none = the tree's passive */
  allStep?: { treeId: string; step: number; skill?: string };
  /** true skill added to every skill with this function (Hunter's Eye: +10 to the sight function) */
  fnSkill?: { fn: SkillFunction; add: number };
  /** a class-level perk (ClassDef.levelPerks): the class and level that grant it */
  classLevel?: { classId: string; level: number };
  /** improvement rolls a marked skill gets while its raw value is below `below` (Quick Study: 2 below 15) */
  improveRolls?: { below?: number; belowShare?: number; rolls: number }; // belowShare (Late Bloom): below this share of the owner's highest raw skill
  freeLevels?: number; // free levels: this many level-ups that cost no XP, given while the perk is owned and active
  bonusLevels?: number; // bonus levels: this many character levels outside every class, given while the perk is owned and active
  perkPoints?: number; // perk points: this many added once to the owner's unspent perk points when the perk is owned and active (Nobody Special)
  searchArea?: number; // SE24: + this % on the owner's search area (and so its fight-turn reach), while owned and active
  searchReach?: number; // SE24: + this many metres of fight-turn search reach (and SEARCH_M2_PER_FIGHT_M m² of search area per metre)
  /** while owned, skill `from` augments `skill` as a SkillDef.augments entry would (true skill × share × tier; its tree open; kind as AugmentKind).
   * No skill: every skill's rolls of the listed kinds. when: only on rolls made in that situation (AugmentWhen). payoff (CN4, D-260):
   * the share is payoffShare of the owned pieces it counts instead of a fixed number. */
  augments?: { from: string; skill?: string; share?: number; kind?: AugmentKind; rollKinds?: import('./items').RollKind[]; when?: AugmentWhen; payoff?: import('../library/perkThemes').PayoffCount }[];
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
/** What a write-up with no ladder yet is kept for: a later milestone perk of its own skill, an All-X candidate
 * (All-100/150 of the skill's tree), or something else. `aimAt` is the suggested milestone (60/100/140) or All tier (100/150). */
export type BankedAs = 'milestone' | 'allX' | 'other';
/** a chosen or banked perk write-up (src/library/perks.ts): ref is its review-page id; place is where it sits for now */
export type PerkWriteup = PerkDef & { ref: string; skill: string; place: '20' | '40' | 'higher' | 'very_high' | 'banked' | 'all50' | 'linked'; story: string; rules: PerkRules;
  bankedAs?: BankedAs; aimAt?: number };

/** The Action times table (T1, AT1, AT11, AT12): how long an action takes, in seconds at a time factor of 1 (a skill-50
 * professional). `orders` lists the order types a row covers today; the action row (DU in src/library/tableIds.ts) is
 * the default turn outside a fight until turns last as long as their order; the sleep row is one sleep. Unset fields
 * read as: no movement lock, focus reflex, stop any, output end, broken off = lost. */
export type DurationDef = {
  id: string; name: string; seconds: number; orders?: string[];
  /** FT24: the effort tier it pays strain at (once, or per STRAIN_LONG_S seconds for a row longer than that) */
  effort: import('../scales').EffortKey;
  /** AT19: the action takes the same seconds from move time */
  locksMove?: boolean;
  /** AT25/AT57: what breaks it from outside (FOCUS key) */
  focus?: import('../scales').FocusKey;
  /** AT26/AT57: whether the actor may choose to stop: any, never, or not past `stopShare` of its progress */
  stop?: import('../scales').StopKey; stopShare?: number;
  /** AT27: what it gives: all at the end, in proportion, or points along the way (OUTPUTS key) */
  output?: import('../scales').OutputKey;
  /** AT6/AT28: what is left when broken off, by progress band: each band runs up to `upTo` (a share, 0-1), lowest first */
  onBreak?: readonly { readonly upTo: number; readonly then: import('../scales').BreakKey; readonly misfire?: string }[];
  /** D-248 backbone: the function whose effective skill speeds it: halved every `halving` points above 50, doubled every
   * `halving` below (no faster past `fastCap`) */
  speed?: { fn: string; halving: number; fastCap?: number | null };
  /** AT72: a reload row names the shot it readies; the two together are one attack cycle */
  readies?: string;
  /** an attack row (the slowest attack cycle sets ENGAGEMENT_END) */
  attack?: boolean;
  /** AT11: done without help it takes this many times as long (heavy armour) */
  aloneMult?: number;
};

/** A healing source (H1/H12): what it restores, the worst part state it can heal (`reach`, a
 * PART_STATES key), whether it works in a fight, and what it needs (a place kind; an item names its source with
 * ItemDef.heal). `hourly` makes it passive: per game hour it restores skill × pctPerPoint % (H12). */
export type HealingDef = {
  id: string; name: string; hpPct: number; partPct: number; reach: PartStateKey; placeKinds?: string[];
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
  /** flat morale points restored instead of a share (TM28: You down a foe, Rallied) */
  points?: number;
  hourly?: { skill: string; pctPerPoint: number };
  /** never applied itself: a source achievements count restored morale under (CP.perk: morale from perks) */
  countOnly?: true;
};

/** FT7/FT28: a stamina recovery source, the stamina twin of a healing row. `linePct`: % of the short line it fills (a rest:
 * by the share of its hour that ran); `perMinute`: % of the line a minute, + Stamina × perPoint (catching your breath);
 * `debtPctPerHour`: % of the bar it clears from the long term an hour (sleep) */
export type RecoveryDef = {
  id: string; name: string; linePct?: number; perMinute?: { pct: number; perPoint: number }; debtPctPerHour?: number;
  /** never applied itself: a source stamina restored by perks is counted under */
  countOnly?: true;
};

/** MB21–MB28: something that costs morale (a negative cost restores it). `rolled`: the morale roll's tier scales the cost
 * (MORALE_TIER_MULT); otherwise it is flat (× `perTier` the contest's tier gap for a lost speech roll).
 * `health`: the HEALTH_LEVELS keys that set it off; perks and achievements move `from` with fearFrom.
 * part: a PART_STATES key; the fear fires when one of the actor's body parts reaches that state or worse from a better one.
 * partCost: its cost per part by the part's impact, for a body of refParts parts; a body with more parts pays less per part
 * (cost × refParts ÷ the body's part count). One roll per hit pays the sum for every part the hit took there. */
export type FearDef = { id: string; name: string; cost: number; rolled: boolean; perTier?: boolean; /** paid outside a fight too (a rolled fear otherwise needs one) */ unengaged?: true; health?: { from: HealthLevelKey; to: HealthLevelKey }; part?: PartStateKey;
  partCost?: Record<ImpactId, number>; refParts?: number;
  /** reads another part fear's partCost and refParts by reference, × mult, so editing that row changes this one too */
  partCostOf?: { fear: string; mult: number } };

/** BR1–BR6: a race is what the being is. It names exactly one body type (BR5), its HP multiplier
 * (BR2) and natural armor (BR6), and adds its own natural attacks and fallback skill to the shape's (BR3).
 * innatePerks / innateQuirks: perk ids every member of the race is born with (OwnedPerk source 'race').
 * Any number of each; empty = none chosen yet. Innate perks must not be quirks, innate quirks must be. */
export type RaceDef = {
  id: string; name: string; bodyTypeId: string; hpMultiplier: number;
  naturalAttacks?: AttackMode[]; naturalArmor?: NaturalArmor; fallback?: { attackSkill: string };
  /** RD7, AB1 c: base speeds in m/s, from real references: walk (a move slot) and run (a dash); worn armor lowers both
   * (engine/speed). On the race, not the body type: one Quadruped shape serves a dog and a tiger */
  speed: { walk: number; run: number };
  /** SZ1: × the body type's size, per measure (left out = 1); written from the race's cited metres (data.ts sized) */
  sizeMult?: { length: number; width: number; height: number };
  innatePerks?: string[]; innateQuirks?: string[];
  tags?: string[]; // 'speaks': the race can talk, which opens persuasion and barter
  playable?: true; // CC7 a: the player can pick this race on the creation screen
  intelligence: IntelligenceKey; // an INTELLIGENCE key (src/scales.ts)
  /** AG4: the age in years at which each life stage starts; left out = ageless (Slime) */
  ageStages?: Partial<Record<import('../scales').LifeStageKey, number>>;
};

/** what an achievement counts (unordered: names are the ids); its text lives in ACH_RULE_TEXT (achievementIds.ts) */
export type AchievementRule = 'places' | 'health_reached' | 'struck_surrendered' | 'killed_surrendered' | 'struck_fleeing' | 'defeats' | 'mastery' | 'unaware_defeats' | 'yielded' | 'crits' | 'beyond_crit' | 'crippled_defeats' | 'zones' | 'ground' | 'deals' | 'days'
  | 'class_unlock' | 'flawless' | 'outnumbered' | 'brink' | 'class_max' | 'class_max_tiers' | 'char_level' | 'held_line' | 'quests_done' | 'quests_abandoned'
  | 'clean_defense' | 'unseen_moves' | 'vanished' | 'spotted' | 'speech_won' | 'talked_down' | 'outmatched' | 'enemy_to_friend' | 'won_without_blow'
  | 'coin_spent' | 'coin_earned' | 'mended' | 'back_from_down' | 'holds' | 'aimed_hits'
  | 'quests_for_giver' | 'quest_givers' | 'quest_chains' | 'quests_early' | 'quests_unpaid' | 'spar_wins' | 'cruel_spar_wins' | 'spar_losses' | 'achievements' | 'defeated'
  | 'won_panicking' | 'morale_breaks' | 'healed' | 'calmed' | 'hp_lost' | 'morale_lost' | 'survived_above' | 'survived_above_pct' | 'won_above' | 'won_above_pct' | 'event_crits' | 'event_crit_fails'
  | 'essences_taken' | 'essence_room' | 'matched_crits' | 'kills' | 'survival_rolls' | 'won_broken' | 'broke_open' | 'bested';
/** what a per-kind achievement is earned once for: the granted id is <id>:<that kind's id> */
export type AchievementBy = 'body_type' | 'race' | 'group' | 'class' | 'class_tier' | 'function' | 'skill' | 'size' | 'giver' | 'heal_source' | 'morale_source' | 'place_kind' | 'health_level';
/** an achievement tag: a key of ACH_TAGS in src/library/achievementIds.ts */
export type AchievementTag = 'combat' | 'stealth' | 'social' | 'exploration' | 'survival' | 'skill' | 'progression';
/** a reward field of AchievementDef */
export type AchievementReward = 'perk' | 'unawareShift' | 'quieter' | 'readsHealth' | 'skillAdd' | 'renown' | 'deathsDoor' | 'firstSight'
  | 'standIn' | 'reqLower' | 'pricePct' | 'rally' | 'restPct' | 'eventRoll' | 'freeLevels' | 'bonusLevels' | 'personality' | 'personalityByKind' | 'tierUnlocks'
  | 'searchArea' | 'searchReach' | 'maxMorale' | 'aimEase' | 'safeBreak' | 'skillAddByKind' | 'sellPct' | 'questPayPct' | 'essenceSlots' | 'defenseRoll' | 'spotRoll' | 'fearFrom';
/** X6/X11: a library achievement, keyed by its fixed id (ACH in src/library/achievementIds.ts), with a name. 'defeats' is
 * earned at `count` defeats (first defeat = count 1). With `by`, it is earned once per kind (body type, race …): the granted
 * id is <id>:<kind> and {body_type}/{race} in the name become what was defeated. 'mastery' once per tree when enough of its
 * skills (by the tree's rating, CONFIG.ALL_STEP_SKILLS) reach `count` (50, 100, 150 …), id <id>:<tree>. level: a
 * REWARD_LEVELS key; its XP is rewardXp(level). after: the key of the lower level this one builds on; earning it
 * switches the lower level off, and its Bane bonus is the lower level's bonus plus its own. scar: a negative achievement,
 * listed under Scars instead of Achievements. */
export type AchievementDef = { id: string; name: string; level: string; rule: AchievementRule; tags: AchievementTag[]; count?: number; by?: AchievementBy; after?: string; scar?: true;
  /** TB1: on the lowest row of a branch, the chain it branches from: the trunk's lowest row, or a head of ACH_HEADS for
   * branches with no trunk. A branch counts one slice of the trunk's act; it never switches the trunk off and carries rewards
   * up only along itself (`after`). Display only. */
  branchOf?: string;
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
  maxMorale?: number; // flat points added to the owner's max morale (ordeals pay nerve, never the skill used)
  aimEase?: number; // TM26: on a by-size row, % taken off the aim penalty for that part size
  safeBreak?: number; // BK4: forcing a container open moves every fragility line this many tiers worse (src/engine/breakage.ts)
  /** XR2: on a by-kind row, true skill added to the skill(s) of the kind it was earned for: a skill row that skill, a group
   * row every skill of the group, a function row that sense's skill (or every skill with the function) */
  skillAddByKind?: number;
  sellPct?: number; // XR2: + this % on what traders pay the owner (the mirror of pricePct)
  questPayPct?: number; // XR2: + this % on the coin a quest giver promises the owner
  essenceSlots?: number; // XR2: this many more essence slots
  defenseRoll?: number; // XR7: + this on the owner's defense rolls (dodge, block, parry)
  spotRoll?: number; // XR37: + this on the owner's spotting rolls (sight, hearing and smell perception rolls)
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
  searchArea?: number; // SE24: + this % on the owner's search area (and so its fight-turn reach)
  searchReach?: number; // SE24: + this many metres of fight-turn search reach (and SEARCH_M2_PER_FIGHT_M m² of search area per metre)
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
