// Part 4 §4 and §9: the actor sheet.
import type { ActorId, Belief, BeliefStatus, Fact, FactId, LibraryRef, PlaceId, SlotKey, StoryId, Turn, Stance } from './core';
import type { ItemInstance } from './items';

/** a standing defense: a choice, not a skill; DEFENSE_SKILL names the skill each one rolls */
export type DefenseKind = 'dodge' | 'block' | 'parry';

export const PRONOUNS = ['he', 'she', 'they', 'it'] as const;
export type Pronouns = (typeof PRONOUNS)[number];

export type NameHistory = { current: string; past: { name: string; untilTurn: Turn }[] };

export type Actor = {
  id: ActorId;
  storyId: StoryId;
  kind: 'player' | 'npc';
  names: NameHistory;
  label: string; // public stranger label
  appearance?: string; // public text from the stage plan (W6)
  pronouns?: Pronouns; // public, from the stage plan (run 14 Q3: agents keep each NPC's pronouns)
  knownOnSight?: boolean;
  placeId: PlaceId; // always the place of `zone`
  zone: string;
  /** ZP1 where it stands in metres on the map (the frame of Zone.rect); code keeps it inside `zone` (engine/position.ts) */
  pos?: { x: number; y: number };
  /** the way it last walked, a unit [east, north]: what its left and right are (BG-18) */
  facing?: [number, number];
  posture?: (typeof import('../scales').POSTURES.keys)[number]; // NS1: any actor can be stealthy
  bandId: string;
  core: Core;
  progression?: Progression;
  mind?: Mind;
  journal?: Journal;
  engagement?: Engagement; // E1: the actor's current engagement; absent when it is in none
  perkMarks?: PerkMark[]; // short-lived perk effects this actor carries (src/engine/perkMarks.ts)
  /** NW12/NW20: asleep since this game minute; `until` ends a planned sleep (the player's, a night watch); none: a
   * routine's sleep, which ends with its time. Asleep, an actor perceives nothing and is an unaware target. */
  asleep?: { since: number; until?: number };
  wokeAt?: number; // NW20: the game minute it last woke; it falls asleep again only FALL_ASLEEP_MIN after
  heldBy?: string; // A8 Hold: the actor holding this one; it can't leave the zone or use two-handed modes (src/engine/held.ts)
  /** PY2: a seller's wares: library item ids it sells from its own stock, and service ids */
  wares?: { items: string[]; services: string[] };
  /** PY6: price multipliers this actor won or lost haggling, by seller; cleared when its engagement ends */
  haggle?: Record<ActorId, number>;
  /** OQ-29: penalties from speech contests this actor lost, by speaker (positive numbers); cleared when its engagement ends */
  pressure?: Record<ActorId, { shaken?: number; swayed?: number }>;
  hunches?: { scenario: number; ids: string[] }; // LI5b Gut Feeling: watchers that set off the owner's hunch this scenario (scenarioStartTurn)
  auraChecks?: string[]; // NT14/I4: the auras (perk:owner) this actor has already checked against this engagement
  /** NT3: speech tries this engagement, by listener and speech kind */
  speechTries?: Record<ActorId, Record<string, number>>;
  /** PY8: healing rows (the clinic's) this actor has paid for and not used yet */
  paid?: string[];
};

/** a perk's lasting effect: target is the actor it names (an opening on that foe); until is the last turn it holds */
export type PerkMark = { perk: string; target?: string; until?: number };

/** E1: one encounter from an actor's point of view, a fight, a negotiation or both. start/last are
 * turns; kinds are what it has held so far; uses counts once-per-engagement effects by id. */
export type EngagementKind = 'talk' | 'fight' | 'spar';
export type Engagement = { start: number; last: number; kinds: EngagementKind[]; uses?: Record<string, number>; fight?: FightLog };
/** the player's fight so far, for the fight achievements: hp = HP lost % last checked; foes = everyone who fought the player;
 * most = the most foes at once; hurt = lost HP; defended = made a defense roll; helped = someone fought a foe of the player's; brink = reached Critical */
export type FightLog = { hp: number; foes: string[]; most: number; hurt?: true; defended?: true; helped?: true; brink?: true; heldLine?: true; down?: true; struck?: true; broke?: true;
  /** the most a hostile foe's power (rating + gear rating) was above the player's: in points and in % */
  above?: number; abovePct?: number };

export type SkillState = 'tagged' | 'normal' | 'flawed';
export type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

export type Core = {
  raceId?: LibraryRef;
  bodyTypeId: LibraryRef;
  templateId?: LibraryRef;
  generation?: 'unique' | 'copy';
  skills: Record<LibraryRef, SkillEntry>;
  classes: ClassEntry[];
  perks: OwnedPerk[];
  condition: SavedCondition;
  inventory: ItemInstance[];
  standingDefense: DefenseKind;
  perksOff?: string[]; // perks the owner switched off (Cover Ally, A11); absent = all on
  personality?: Personality; // PL1: Nerve and personality points, before what perks, classes and achievements add (personalityOf)
  bornDay?: number; // AG2: the game day it was born (before day 1 is 0 and below); left out = no age (an ageless race)
};

/** PL1: Nerve runs Cautious (−100) to Daring (+100); traits are points by personality axis (PA…, −100 to +100); values
 * are what the character cares about (VL…). Words and named types are read from these, never stored. */
export type Personality = { nerve: number; traits: Record<LibraryRef, number>; values: LibraryRef[] };

export type ClassEntry = {
  classId: LibraryRef;
  state: 'unlocked' | 'current' | 'previous';
  level: number;
  dormant?: boolean;
};

export type OwnedPerk = {
  perkId: LibraryRef;
  source: 'level' | 'mastery' | 'race' | 'template' | 'class' | 'achievement' | 'link' | 'item'; // 'item': granted by a worn Threadbound item (D-218) // 'class': a class-level perk (ClassDef.levelPerks); 'race': innate, from the race's innatePerks / innateQuirks; 'template': the NPC template's perks
  gainedTurn: Turn;
  treeId?: LibraryRef;
  tier?: 50 | 100 | 150;
  dormant?: boolean;
  /** a linked perk of kind 'merge' replaced this one (it is dormant until the merge no longer holds) */
  mergedInto?: LibraryRef;
  /** TB7: the Threadbound item (library id) this perk already gave; grantsThreadboundItem gives only once */
  granted?: LibraryRef;
};

export type SavedCondition = {
  hpLostPct: number; // health-track level is derived from this
  parts: Record<string, number>; // body-part id -> pool % left (100 = full), state derived
  destroyed?: string[]; // reserved
  status: string[];
  moraleLost?: number; // MB5: flat morale points lost; the level is derived from this and max morale
};

export type Progression = {
  startingTotal: number;
  potential: { base: number; adjustments: { source: string; delta: number; turn: Turn }[] };
  xp: number;
  unspentPerkPoints: number;
  /** skills waiting for an improvement roll; a skill appears once per roll it is owed (SM1 stacking) */
  marks: LibraryRef[];
  /** SM1/SM3: marks each skill got this engagement (or this scenario, outside one), cleared when it ends */
  markCounts?: Record<LibraryRef, number>;
  xpLog?: XpAward[]; // source trail (B8); every award, in order
  /** every scenario's gains as the gains moment showed them, oldest first, for the Gains page (D-226); never trimmed */
  gainsLog?: import('./game').GainsRecord[];
  /** earned, each once (B4, X6). key = the library achievements table row, of = the body type, race or tree it names;
   * the name and XP level live only in that table. name is only on entries from older saves. */
  achievements?: { id: string; key?: string; of?: string; name?: string; turn: Turn; replacedBy?: string; reached?: number }[]; // reached: the tally that earned it
  /** D-226: achievements earned while a scenario runs, granted at its end (grantAchievement queues them) */
  pendingAchievements?: { key: string; of?: string; reached?: number }[];
  title?: string; // T18: the id of the earned achievement worn as a title (wornTitle in src/engine/xp.ts)
  /** achievement tallies: '<rule>' or '<rule>:<by>:<of>' (a count, or the best reached for days, zones and beyond_crit) */
  tally?: Record<string, number>;
  /** achievement charges: the game day each was last spent, by achievement key */
  charges?: Record<string, number>;
  /** skills the player has rolled, on the sheet or not, so the sheet and /stats can show an off-sheet skill in use (fists: Strike) */
  used?: LibraryRef[];
  zonesSeen?: string[]; // zones the player has entered
  crippled?: string[]; // parts Crippled or worse, waiting to heal back to Healthy (the 'mended' achievements)
  wasDown?: true; // went Down and is not yet back to Unhurt (the 'back_from_down' achievement)
  grudges?: string[]; // people who have been hostile to the player and are not yet friendly (the 'enemy_to_friend' achievements)
  /** alternate capstones the player may swap in for a class's default, by class id; set when the class reaches
   * its top level with those alternates' conditions met, and cleared by a swap */
  capstoneOptions?: Record<LibraryRef, LibraryRef[]>;
  freeLevelsTaken?: number; // free levels already taken (owed = levelsEarned(a, 'freeLevels') − this)
  bonusLevelsTaken?: number; // bonus levels already taken: character levels outside every class (owed = levelsEarned(a, 'bonusLevels') − this)
  nextClass?: LibraryRef; // X9: the class the next level goes to (current or unlocked); absent = current
  /** growth proposal 2.5: essences held (at most essenceSlots), and essences on offer (each until its turn, or a new scenario) */
  essences?: HeldEssence[];
  essenceOffers?: EssenceOffer[];
  quickHeal?: LibraryRef; // H3: the healing item (item def id) the quick slot shows; absent = the strongest
};

/** an essence: its row, the grade its offer roll gave, and the true skill it adds (its points, split by the row's weights) */
export type HeldEssence = { essence: LibraryRef; grade: import('../scales').EssenceGradeKey; points: Record<LibraryRef, number>; turn: Turn; from?: string };
/** an essence on offer: where it came from (a beaten foe's name, or the scenario's ending) and the last turn it can be taken */
export type EssenceOffer = HeldEssence & { source: 'foe' | 'ending'; until: Turn };
export type XpAward = { source: string; amount: number; turn: Turn; levelUp?: { classId: LibraryRef; level: number } };

export type Mind = {
  control: 'agent' | 'code';
  /** PM6: code-made lines about perceived events that fell out of its recent window; upTo = last summarized event id */
  earlier?: { upTo: string; lines: string[] };
  moraleState?: 'broken' | 'surrendered';
  hitByPlayer?: true; // X5: the player has hit it
  hitUnaware?: true; // the player's last damaging hit landed while it was unaware
  xpPaid?: true; // its defeat has paid XP (B4)
  essenceRolled?: true; // growth proposal 2.3: its defeat has rolled for an essence (one offer per foe, ever)
  knowledge: Record<ActorId, Belief>;
  /** BG-95: names this NPC heard said aloud while it saw who they belong to (learnNames) */
  namesKnown?: ActorId[];
  heardOf?: ActorId[]; // NM2, as Journal.heardOf
  aliases?: Record<ActorId, string>; // NM3, as Journal.aliases
  overrides?: Record<ActorId, Stance>;
  knows: Fact[];
  /** at (NW10): the game minute the routine started; its steps run on the clock from there */
  routine?: RoutineRun;
  /** NW2: on head_to, the routine it goes back to once it gets there */
  headBack?: RoutineRun;
  routines?: string[];
  routineSetId?: LibraryRef;
  slots?: Record<string, string | string[]>;
  alarm?: { armed: boolean; lastAlarmTurn?: Turn; returnTo?: RoutineRun; onAlertDue?: string /* routine id whose onAlert is still to fire (W5) */ };
};

/** a routine an NPC is running: anchorTurn the turn it started, at (NW10) the game minute it started */
export type RoutineRun = { id: string; anchorTurn: Turn; at: number };

export type NpcTemplate = {
  id: LibraryRef;
  raceId: LibraryRef; // BR5: the body type comes from the race
  classId?: LibraryRef;
  generation: 'unique' | 'copy';
  minimums: Record<LibraryRef, number>;
  level: number;
  bonusPoints: number;
  focus: { treeId: LibraryRef; skill: LibraryRef }[];
  resolve: number; // starting Resolve (MB30)
  personality: Personality; // PL11: Nerve, trait and value points
  loadout?: LibraryRef[];
  potential?: number;
  control: 'agent' | 'code';
  label: string;
  fallback?: { attackSkill: LibraryRef }; // overrides the body type's (Fallback behavior)
  /** perks every NPC made from this template has (any patrolling template has Keen Ear) */
  perks?: LibraryRef[];
  /** CH5: how far NPCs made from it chase the player when their band names no range */
  chase?: import('../scales').ChaseRange;
  /** AG13: the life stages NPCs made from it are drawn from; left out = CONFIG.NPC_AGE_STAGES */
  ageStages?: import('../scales').LifeStageKey[];
  /** growth proposal 2.3: a leader or other notable NPC: beating it may offer an essence whatever its power */
  notable?: true;
};

export type Journal = {
  secretsKnown: string[];
  factsWitnessed: FactId[];
  remembered: Record<SlotKey, { value: string; seenTurn: Turn }>;
  namesKnown: ActorId[];
  /** NM2: names heard of someone the player could not see then; they attach once that person answers to the name */
  heardOf?: ActorId[];
  /** NM3: false names the player believed, by whom they were told of */
  aliases?: Record<ActorId, string>;
  /** Q17: actors the player has seen clearly, and the zone they were in; they stay seen until they move */
  clearSight?: Record<ActorId, string>;
  /** BG-28: where the player last saw or heard each actor (any perception of it, a sound included); never forgotten by an
   * unseen move, so lastSeen still names someone heard running off */
  lastKnown?: Record<ActorId, string>;
  /** BG-125: the point in that zone where the player last perceived each actor, when the event had one */
  lastSpot?: Record<ActorId, { x: number; y: number }>;
  /** NS2/NS4: the player's belief about each stealthy actor (open actors are simply seen) */
  stealthSeen?: Record<ActorId, BeliefStatus>;
  /** the places the player last left, newest first, with the turn it left each (CONFIG.TRAIL_ZONES long): "go back" reads it */
  trail?: { zone: string; left: Turn }[];
  /** the Map page: every zone the player has stood in or seen across a sight link, oldest first */
  zonesSeen?: string[];
};

export type { PlaceId };
