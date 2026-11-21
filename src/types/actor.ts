// Part 4 §4 and §9: the actor sheet.
import type { ActorId, Belief, BeliefStatus, Fact, FactId, LibraryRef, PlaceId, SlotKey, StoryId, Turn, Stance } from './core';
import type { GearOp, ItemInstance } from './items';

/** MQ8/MQ15 a: the action a walk carries to the thing it is done on (busy.order's shape, with a way op or the pick-ups) */
export type WalkThen = { type: string; target: string | null; item: string | null; way?: { toZone: string; op: import('../engine/barriers').WayOp }; gear?: GearOp[] };

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
  /** KN1 b: whose name and face everyone knows on sight: those who live in its settlement, or everyone */
  knownOnSight?: 'locals' | 'everyone';
  /** KN2 b: what people call it once they know it ("the headman"), shown in place of label to them */
  knownAs?: string;
  placeId: PlaceId; // always the place of `zone`
  zone: string;
  /** ZP1 where it stands in metres on the map (the frame of Zone.rect); code keeps it inside `zone` (engine/position.ts) */
  pos: { x: number; y: number };
  /** D-1623: the height of the floor it stands on, in metres (Zone.floor of the frame); its own, never read from its title */
  floor: number;
  /** ZP1: just put in its title (spawned, or brought onto the stage) with a stand-in point: placeAll gives it a free spot
   * there and clears this */
  unplaced?: true;
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
  /** TC44 a Play Dead: the turn a blow left it Wounded or worse (not Down); the move is open that turn and the next */
  playDeadOpen?: number;
  /** TC32 a Play Dead (engine/playDead.ts): lying as if Down. believers: the foes who take it for Down (each on its own,
   * TC48 a, so a sharing rule can take ids out); judged: every foe that has rolled against it */
  playingDead?: { believers: string[]; judged: string[] };
  /** the actor whose blow last took it Down, and the one whose blow killed it (deed achievements) */
  downedBy?: string;
  killedBy?: string;
  /** TC50-TC52 a S3 feigned flight (engine/feint.ts): when it began (game minutes) and the foes who believe the flight */
  feint?: { at: number; believers: string[] };
  /** NW12/NW20: asleep since this game minute; `until` ends a planned sleep (the player's, a night watch); none: a
   * routine's sleep, which ends with its time. Asleep, an actor perceives nothing and is an unaware target. */
  asleep?: { since: number; until?: number; bed?: string }; // bed (MQ13 a): the bed it lies on and holds, one sleeper each
  wokeAt?: number; // NW20: the game minute it last woke; it falls asleep again only FALL_ASLEEP_MIN after
  /** AT20: main and move seconds left after its last finished action, carried into the next turn only (`turn` they came from) */
  carry?: { main: number; move: number; turn: number }[]; // AT20/TP4: carried time, one entry per turn it was left over in
  /** AT58: the reaction rolled when the actor's fight started (seconds, the initiative total that breaks ties), and the last
   * fight turn it counted in: a fight turn after a turn without one rolls again */
  react?: { s: number; init: number; turn: number };
  /** AT2/AT17: a long action under way: its Action times row, the order it came from, seconds done of `need`, the turn it last
   * went on; `paused` when broken off or set aside with its work kept (AT6/AT28: picked up again by the same order) */
  busy?: {
    row: string; key: string; order: { type: string; target: string | null; item: string | null }; done: number; need: number; turn: number; paused?: true;
    /** AT67 for an NPC at it (AT47): whom it accepted, and what it noted of each (comingNear busyCheck) */
    watch?: Record<string, { sneaking: boolean; closing: boolean; armed: number }>;
    /** AT47/AT67: its coming-near check fired: it is asked for a new order next turn */
    alert?: true;
    /** AE6 (RY5 b): a readied step that fired too late in its turn: it finishes first thing next turn, whatever is ordered */
    ready?: import('./ruleset').Order;
  };
  /** AT49: the player's walk not yet at its goal, carried on by the next turns until another move or action is ordered;
   * then (MQ8, MQ15 a): the action it walks to do, done where it ends */
  walking?: NonNullable<import('./agents').Intent['move']> & { then?: WalkThen };
  /** AE6: a readied step (the player's, or an NPC's, RQ3 a), waiting for `when`; `waited`: fight seconds held so far (CONFIG.READY_MAX_S) */
  readied?: { when: import('../scales').ReadyWhen; order: import('./ruleset').Order; waited: number; since?: number /* world minutes when readied: an NPC's lasts WAIT_SOMEONE_MAX_H outside a fight */ };
  /** RE1 (BG-291): minutes travelled on roads since the last encounter roll, carried from trip to trip; a full TRAVEL_LEG_MIN rolls */
  roadMin?: number;
  /** BG-190: the player lost the one they were following this turn: who, why, and the zone they last had them in */
  followLost?: { who: string; why: 'down' | 'slipped_away' | 'out_of_sight'; zone: string };
  /** BF34: something it holds out to `to` (an item instance, from hand, pack or its own bag): it changes hands only when
   * `to` takes it; withdrawn after the turn after `turn` */
  offer?: { item: string; qty?: number; to: string; turn: number };
  letsSearch?: { by: string; until: number }; // BF16: lets `by` search it hands-on, until that turn
  heldBy?: string; // A8 Hold: the actor holding this one; it can't leave the zone or use two-grip modes (src/engine/held.ts)
  /** PY2: a seller's wares: library item ids it sells from its own stock, and service ids */
  wares?: { items: string[]; services: string[] };
  /** ES6 a: essences a seller bought and holds to sell on (it has no room, or no slots, to take them in) */
  essenceStock?: HeldEssence[];
  /** PY6: price multipliers this actor won or lost haggling, by seller. LG13 b: a won one lasts the rest of the day it was
   * won (haggleDay); a bad loss is cleared when the actor's engagement ends (keepHaggles, src/engine/trade.ts) */
  haggle?: Record<ActorId, number>;
  haggleDay?: Record<ActorId, number>;
  /** OQ-29: penalties from speech contests this actor lost, by speaker (positive numbers); cleared when its engagement ends */
  pressure?: Record<ActorId, { shaken?: number; swayed?: number }>;
  hunches?: { scenario: number; ids: string[]; tried?: Record<string, number> }; // LI5b Gut Feeling: watchers that set off the owner's hunch this scenario (scenarioStartTurn); tried: the turn each watcher was last rolled against (AT74)
  sightChecks?: string[]; // the on-sight quirks (perk:owner) this actor has met: once per owner, for good
  auraChecks?: string[]; // NT14/I4: the auras (perk:owner) this actor has already checked against this engagement
  /** NT3: speech tries this engagement, by listener and speech kind */
  speechTries?: Record<ActorId, Record<string, number>>;
  /** PY8: healing rows (the clinic's) this actor has paid for and not used yet */
  paid?: string[];
};

/** a perk's lasting effect: target is the actor it names (an opening on that foe); made: the turn a timed mark was made (it
 * lasts PERK_MARK_ROUNDS rounds of game time from then); none: until used */
export type PerkMark = { perk: string; target?: string; made?: number; /** the tier shift it gives, when not 1 (LR2 Combination) */ value?: number };

/** E1: one encounter from an actor's point of view, a fight, a negotiation or both. start/last are
 * turns; kinds are what it has held so far; uses counts once-per-engagement effects by id. */
export type EngagementKind = 'talk' | 'fight' | 'spar';
export type Engagement = { start: number; last: number; kinds: EngagementKind[]; uses?: Record<string, number>; fight?: FightLog;
  /** TC41 a: rallied this fight (Battle Cry's rally; Rally later): CONFIG.RALLIED_MOD on every roll until the engagement ends */
  rallied?: true;
  /** TC35 b Never Flat-Footed: everyone its owner has seen this engagement (kept only for owners of the perk) */
  seen?: string[];
  /** GR44: its power when it joined the fight (engine/xp.ts notePower); defeat XP and the stronger-foe achievements read it */
  power?: number };
/** the player's fight so far, for the fight achievements: hp = HP lost % last checked; foes = everyone who fought the player;
 * most = the most foes at once; hurt = lost HP; defended = made a defense roll; helped = someone fought a foe of the player's; brink = reached Critical */
export type FightLog = { hp: number; foes: string[]; most: number; hurt?: true; defended?: true; helped?: true; brink?: true; heldLine?: true; down?: true; struck?: true; broke?: true; moved?: true;
  /** the most a hostile foe's power (rating + gear rating) was above the player's: in points and in % */
  above?: number; abovePct?: number };

export type SkillState = 'tagged' | 'normal' | 'flawed';
export type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

export type Core = {
  raceId?: LibraryRef;
  bodyTypeId: LibraryRef;
  templateId?: LibraryRef;
  /** NR37: a beast's prefix (PF…): Dire = one rank up (in its sheet) and more health (prefixes table) */
  prefix?: LibraryRef;
  generation?: 'rolled' | 'copy' | 'unique';
  /** NF4 b: filled a notable roster hook (Leader, Rival, Seat of the Great, Warden), so it is a notable foe */
  notable?: true;
  /** HF21: where a unique came from; an echo (a fallen hero from the Hall of fame) keeps its sheet and never learns (D-243) */
  origin?: 'echo';
  skills: Record<LibraryRef, SkillEntry>;
  classes: ClassEntry[];
  perks: OwnedPerk[];
  condition: SavedCondition;
  inventory: ItemInstance[];
  standingDefense: DefenseKind;
  perksOff?: string[]; // perks the owner switched off (Cover Ally, A11); absent = all on
  personality?: Personality; // PL1: Nerve and personality points, before what perks, classes and achievements add (personalityOf)
  /** short lines on how this character acts or talks, set on the Character page; given with its personality line */
  signatures?: string[];
  bornDay?: number; // AG2: the game day it was born (before day 1 is 0 and below); left out = no age (an ageless race)
  talent?: import('../scales').TalentKey; // AG25: an NPC's talent, set once at spawn (it set its youngest age); the player has none (AG27)
  /** DX5: Hollowed by an essence extraction: the share of true skill lost in each of the essence's skills, and in every skill */
  hollowed?: { skills: Record<LibraryRef, number>; all: number };
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
  source: 'level' | 'mastery' | 'race' | 'template' | 'class' | 'achievement' | 'link' | 'item' | 'essence' | 'inflicted' | 'start'; // 'start': given by the Start at creation (a blessed start's blessing) // 'inflicted': done to them by someone (Hollowed, DX5) // 'essence': a held essence's trait or quirk (D-229), once however many carry it (FP8) // 'item': granted by a worn Threadbound item (D-218) // 'class': a class-level perk (ClassDef.levelPerks); 'race': innate, from the race's innatePerks / innateQuirks; 'template': the NPC template's perks
  gainedTurn: Turn;
  treeId?: LibraryRef;
  tier?: number; // the All step (50, 100, 150 …; CS11)
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
  tended?: { turn: number; by: string; itemId: string }; // BG-181: the last healing item used on it, until its next wound
  moraleLost?: number; // MB5: flat morale points lost; the level is derived from this and max morale
  /** SY1: Mentally steady, from steadying oneself at Great Success or better: the next morale loss is halved, then it is gone */
  mentallySteady?: true;
  /** SY1: the turn it last steadied itself (STEADY_COOLDOWN_S of game time before the next try) */
  steadiedTurn?: number;
  /** FT1/FT18: the stamina bar, in flat points used: debt = the long term (sleep debt and spilled strain), line = the short
   * line (strain); hardAt = game minute of its last effort above Light (catching your breath waits BREATH_CALM_S after it);
   * toMark = strain not yet counted into a Stamina mark; awake = the share of debt from hours awake, uncapped (FB4) */
  fatigue?: { debt: number; line: number; hardAt?: number; toMark?: number; awake?: number };
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
   * the name and XP level live only in that table. */
  achievements?: { id: string; key?: string; of?: string; turn: Turn; replacedBy?: string; reached?: number }[]; // reached: the tally that earned it
  /** D-226: achievements earned while a scenario runs, granted at its end (grantAchievement queues them) */
  pendingAchievements?: { key: string; of?: string; reached?: number; turn?: number }[]; // turn: when it was reached (BF60)
  title?: string; // T18: the id of the earned achievement worn as a title (wornTitle in src/engine/xp.ts)
  /** achievement tallies: '<rule>' or '<rule>:<by>:<of>' (a count, or the best reached for days, zones and beyond_crit) */
  tally?: Record<string, number>;
  /** achievement charges: the game day each was last spent, by achievement key */
  charges?: Record<string, number>;
  /** skills the player has rolled, on the sheet or not, so the sheet and /stats can show an off-sheet skill in use (fists: Strike) */
  used?: LibraryRef[];
  zonesSeen?: string[]; // PZ13: titles the player has entered
  cellsStood?: string[]; // PZ17: the land cells (REGION_CELL_M squares, '<x>:<y>' on the world's grid) the player has stood in
  placesSeen?: string[]; // TM14: places the player has stood in, or that held where they stood (counted per kind)
  /** AS1–AS11: foes the player struck while seeing them surrendered or broken, each counted once */
  gaveUpStruck?: { surrendered: string[]; broken: string[] };
  crippled?: string[]; // parts Crippled or worse, waiting to heal back to Healthy (the 'mended' achievements)
  wasDown?: true; // went Down and is not yet back to Unhurt (the 'back_from_down' achievement)
  grudges?: string[]; // people who have been hostile to the player and are not yet friendly (the 'enemy_to_friend' achievements)
  /** alternate capstones the player may swap in for a class's default, by class id; set when the class reaches
   * its top level with those alternates' conditions met, and cleared by a swap */
  capstoneOptions?: Record<LibraryRef, LibraryRef[]>;
  freeLevelsTaken?: number; // free levels already taken (owed = rewardSum(a, 'freeLevels') − this)
  bonusLevelsTaken?: number; // bonus levels already taken: character levels outside every class (owed = rewardSum(a, 'bonusLevels') − this)
  perkPointsTaken?: number; // perk points already added from perks (owed = the active perks' PerkDef.perkPoints − this)
  nextClass?: LibraryRef; // X9: the class the next level goes to (current, unlocked or previous, D-65); absent = current
  /** growth proposal 2.5: essences held (at most essenceSlots), and essences on offer (each until its turn, or a new scenario) */
  essences?: HeldEssence[];
  essenceOffers?: EssenceOffer[];
  essenceChanges?: number; // EB3: essences let go or swapped out so far (the first ESSENCE_FREE_CHANGES cost no XP)
  quickHeal?: LibraryRef; // H3: the healing item (item def id) the quick slot shows; absent = the strongest
};

/** an essence: its row, the grade its quality roll gave, and the true skill it adds (its points, split by the row's weights) */
export type HeldEssence = { essence: LibraryRef; grade: import('../scales').EssenceGradeKey; points: Record<LibraryRef, number>; turn: Turn; from?: string };
/** an essence on offer: where it came from (a beaten foe's name, or the scenario's ending) and the last turn it can be taken */
export type EssenceOffer = HeldEssence & { source: 'foe' | 'ending' | 'extract'; /** AT75: game minutes it waits until */ untilMin: number;
  /** EB1: one of an ending's two offers; taking (or giving or selling) one lets the other go */ pair?: string };
export type XpAward = { source: string; amount: number; turn: Turn; levelUp?: { classId: LibraryRef; level: number }; why?: DefeatWhy }; // why: BG-199, how a defeat came
/** BG-199: how a foe was beaten: down, or still up but broken or surrendered to the player */
export type DefeatWhy = 'down' | 'broken' | 'surrendered';

/** D-206: the regard score behind a personal stance (Mind.regard) */
export type Regard = { v: number; at: number; step: import('../scales').StanceKey; attacked?: true };

export type Mind = {
  control: 'agent' | 'code';
  /** PM6: code-made lines about perceived events that fell out of its recent window; upTo = last summarized event id */
  earlier?: { upTo: string; lines: string[] };
  moraleState?: 'broken' | 'surrendered';
  hitByPlayer?: true; // X5: the player has hit it
  hitUnaware?: true; // the player's last damaging hit landed while it was unaware
  xpPaid?: true; // its defeat has paid XP (B4)
  essenceRolled?: true; // growth proposal 2.3: its defeat has rolled for an essence (one offer per foe, ever)
  bested?: true; // BS3 a: the player has bested it (once per person, ever)
  knowledge: Record<ActorId, Belief>;
  /** GD3: a guard's suspicions: whom it suspects, over which locked container, since when (src/engine/suspicion.ts) */
  suspects?: Record<ActorId, { box: string; turn: number; asked?: number }>; // asked: the turn a code-run guard last asked to see inside
  /** BG-95: names this NPC heard said aloud while it saw who they belong to (learnNames) */
  namesKnown?: ActorId[];
  heardOf?: ActorId[]; // NM2, as Journal.heardOf
  aliases?: Record<ActorId, string>; // NM3, as Journal.aliases
  overrides?: Record<ActorId, Stance>;
  /** D-206 BN1 a: the regard score under an override (src/engine/regard.ts): v at game minute `at`, the last move between
   * the two; step: the override it was kept for (another writer that changes the override leaves it unread); attacked:
   * the grudge is over an attack on itself (BN2 a) */
  regard?: Record<ActorId, Regard>;
  knows: Fact[];
  /** at (NW10): the game minute the routine started; its steps run on the clock from there */
  routine?: RoutineRun;
  /** NW2: on head_to, the routine it goes back to once it gets there */
  headBack?: RoutineRun;
  /** BF4: on head_to, who it leads there; at the end it waits for them (since: the turn it got there) */
  leading?: { id: string; since?: number };
  stay?: { zone: string; since: number }; // BF11: a place its own agent moved it to holds AGENT_STAY_S from this turn
  startled?: number; // BF65: the turn it was struck unseen, saw someone struck, or found a body: it gets a Planner call to react
  bodiesFound?: string[]; // BF65: the bodies it has come upon or seen fall (each found once)
  /** WN8 a: what it saw through or spotted itself, still to warn its allies of (engine/warnings.ts), and the warnings given (about:trick -> the turn) */
  toWarn?: { about: ActorId; trick: string }[];
  warned?: Record<string, number>;
  /** WN4 b: a hidden foe an ally pointed out, and when: its next notice or search roll at it is easier */
  pointed?: Record<ActorId, number>;
  rowsUsed?: Record<string, number>; // D-17: the turn each FIGHT_RULES row (FX id) last gave its order; one used since its engagement began counts as used this fight
  drawnOnPurpose?: true; // DS2: its steel is drawn by its own choice, so code does not sheathe it when calm
  lastWasted?: { turn: number; action: string; reason: string }; // BG-181: its last try that came to nothing, until it does that kind of thing
  errandUntil?: number; // BG-180: it told someone it was doing something; it gets Planner calls through this turn
  /** AT63: time ran on past its agent's order (a stretch or a night) while it went on by code; its next Planner call is told */
  meanwhile?: { turn: number; seconds: number };
  /** CS22: its routine spot (to) has no path from where it stands (from); routine_unreachable was logged for this pair */
  unreachable?: { from: string; to: string };
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
  /** HF15: copy (identical, follows the template live), rolled (each NPC rolls its own person once), unique (one saved
   * character: `unique` holds its sheet, spawned exactly as saved, at most once per world) */
  generation: 'rolled' | 'copy' | 'unique';
  unique?: UniqueSheet;
  /** hand-set floors a preset's story needs (loadout requirements, a search skill); class floors are added in code */
  minimums: Record<LibraryRef, number>;
  /** NG1, NG7: a preset's layers; the rank sets its level and, with the role and theme, its skills */
  roleId?: LibraryRef;
  themeId?: LibraryRef;
  rank?: import('../scales').RankKey;
  /** NR37: a beast's prefix (PF…, such as Dire): its rank step is already in `rank`; the actor carries it for health */
  prefix?: LibraryRef;
  /** NR40: a grandeur that overrides its role's and theme's (a seat of the Great is grand) */
  grandeur?: import('../scales').GrandeurKey;
  /** a unique's level, from its saved sheet; presets never set one (NG7) */
  level?: number;
  resolve: number; // starting Resolve (MB30)
  personality?: import('./library').PersonalityLean; // PL11, NG14: the preset's own pins, over its theme's and role's leans (presetPersonality)
  /** a rolled NPC's title ("the Butler"), given with its name in CHARACTER */
  title?: string;
  /** a rolled NPC's hand-written if-then lines, given right after Nerve in its personality line */
  signatures?: string[];
  /** UG3 d: a goal written on the template; every NPC cast from it holds it until it is met */
  standingGoal?: string;
  loadout?: LibraryRef[];
  potential?: number;
  control: 'agent' | 'code';
  label: string;
  fallback?: { attackSkill: LibraryRef }; // overrides the body type's (Fallback behavior)
  /** perks every NPC made from this template has (any patrolling template has Keen Ear) */
  perks?: LibraryRef[];
  /** SS12: for each tag, every NPC made from it rolls one quirk carrying that tag (PerkDef.tags) */
  quirkTags?: string[];
  /** CH5: how far NPCs made from it chase the player when their band names no range */
  chase?: import('../scales').ChaseRange;
  /** AG13: the life stages NPCs made from it are drawn from; left out = CONFIG.NPC_AGE_STAGES */
  ageStages?: import('../scales').LifeStageKey[];
  /** AG25: how fast NPCs made from it trained, which sets their youngest age for the rank; left out = the theme's, then CONFIG.NPC_TALENT_DEFAULT */
  talent?: import('../scales').TalentKey;
  /** growth proposal 2.3: a leader or other notable NPC: beating it may offer an essence whatever its power */
  notable?: true;
  /** EN3 b: a hand-set essence list that replaces the worked-out one (templateEssences). An echo carries only its own
   * essence (a row with from.echo); other templates leave it out. */
  essences?: LibraryRef[];
};

/** HF3, HF15: a unique NPC's whole sheet as it was saved (an echo: the hero at death). Its gear is soulbound copies (HF18);
 * items made in its own story travel with it in itemDefs, under ids of their own. */
export type UniqueSheet = {
  origin: 'echo';
  name: string;
  pronouns?: Pronouns;
  appearance?: string;
  classes: ClassEntry[];
  skills: Record<LibraryRef, SkillEntry>;
  perks: OwnedPerk[];
  personality: Personality;
  standingDefense: DefenseKind;
  /** HF20: its age in days when it was saved (an echo stays the age it died at); left out = ageless */
  ageDays?: number;
  gear: ItemInstance[];
  itemDefs?: import('./items').ItemDef[];
  /** HF21: achievements and scars it had (progression.achievements); title: the one it wore */
  achievements: NonNullable<Progression['achievements']>;
  title?: string;
  essences?: HeldEssence[];
  /** HF2: hidden from the player: who it was and how it fell, for the Weaver and the Narrator */
  past: string;
  /** the story it was sent from (its Hall of fame card shows it is in the library) */
  from?: string;
};

export type Journal = {
  revealed?: string[]; // SE11: others' concealed or stowed gear the player has found ('item:<instance id>'), as NPC beliefs' revealed
  secretsKnown: string[];
  factsWitnessed: FactId[];
  remembered: Record<SlotKey, { value: string; seenTurn: Turn }>;
  namesKnown: ActorId[];
  /** NM2: names heard of someone the player could not see then; they attach once that person answers to the name */
  heardOf?: ActorId[];
  /** NM3: false names the player believed, by whom they were told of */
  aliases?: Record<ActorId, string>;
  /** Q17, BG-1618: actors the player has seen clearly, and the point (and height) where; they stay seen clearly while
   *  they stay within CLEAR_SIGHT_STAY_M of it */
  clearSight?: Record<ActorId, import('./core').Pt3>;
  /** BG-28: where the player last saw or heard each actor (any perception of it, a sound included); never forgotten by an
   * unseen move, so lastSeen still names someone heard running off */
  lastKnown?: Record<ActorId, string>;
  /** BG-125: the point (and floor) where the player last perceived each actor, when the event had one */
  lastSpot?: Record<ActorId, import('./core').Pt3>;
  /** MAP-68 (RX1 a): the body the player last saw clearly of each actor, its floor size in metres and the way it faced
   *  (as SeenActor.body): the Map draws someone out of full sight this size at lastSpot */
  lastBody?: Record<ActorId, { lengthM: number; widthM: number; facing: [number, number] }>;
  /** NS2/NS4: the player's belief about each stealthy actor (open actors are simply seen) */
  stealthSeen?: Record<ActorId, BeliefStatus>;
  /** WN2/WN11: the tricks the player saw through or was warned of, by whose (engine/warnings.ts); as NPCs' ruse facts */
  ruses?: Record<ActorId, string[]>;
  /** WN4 b: a foe an ally pointed out while hidden, and when: the player's next notice or search roll at it is easier */
  pointed?: Record<ActorId, Turn>;
  /** the places the player last left, newest first, with the turn it left each (CONFIG.TRAIL_ZONES long): "go back" reads it */
  trail?: { zone: string; left: Turn }[];
  /** PZ13: every title the player has stood in or looked into (its name is known), oldest first */
  zonesSeen?: string[];
  /** every title the player has stood in, oldest first (the turn's new places, agents/game.ts) */
  zonesVisited?: string[];
  /** PZ12 a, the Map's fog: the ground the player has seen, in squares (1 m under a roof, FOG_OPEN_SQUARE_M in the open
   * where no land lies under it) per floor: chunks of FOG_CHUNK squares a side, keyed '<floor>:<size>:<cx>:<cy>', one bit
   * per square, base64 (src/plan/fog.ts); in the open over the land, landSeen */
  seenSquares?: Record<string, string>;
  /** MAP-33: the squares of seenSquares in sight at the latest look, kept the same way and replaced at each look; the Map
   *  draws the rest of the seen ground faded */
  sightSquares?: Record<string, string>;
  /** WZ4 the land the player has made out, per region id: one bit per grid cell, base64 (src/land/sight.ts) */
  landSeen?: Record<string, string>;
};

export type { PlaceId };
