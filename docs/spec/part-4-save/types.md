### 9. Types

These types replace Part 2's GameState and Actor as the saved shape. Belief, Fact, Zone, ZoneLink, Band, HiddenStore, GameEvent, AgentTurnLog, Tier and EventRollResult keep their Part 2 definitions. Fields marked reserved hold a place for an open question and are not used yet.

```ts
// ---------- ids ----------
type StoryId = string;
type ActorId = string;
type PlaceId = string;
type FactId = string;
type LibraryRef = string;   // id in the story's blueprints or the library (story first)
type SlotKey = string;      // '<subject>.<attribute>', e.g. 'gilded_cup.north_wall'
type Turn = number;
type Grade = 'none' | 'minor' | 'moderate' | 'major' | 'extreme';   // [Proposed] challenge and gain scale

// ---------- library (shared by every story) ----------
type LibraryMeta = {
  libraryVersion: number;   // bumps on every library edit
  status: Record<LibraryRef, EntryStatus>;
};
type EntryStatus =
  | { state: 'active' }
  | { state: 'renamed'; to: LibraryRef }
  | { state: 'replaced'; by: LibraryRef }
  | { state: 'deleted' };   // saves keep the id dormant

type ItemDef = {                       // library entry or story blueprint (kind 'item'); Part 5
  id: LibraryRef;
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'tool' | 'consumable' | 'misc';
  name: string; look: string;          // public text
  bulk: 0 | 1 | 2 | 3;                 // no carry limit yet
  value: number;                       // base price in coins; placeholder, unused until trade
  stackable?: true;
  consumable?: true;                   // removed on use
  concealed?: true;                    // hidden from others until used
  hiddenAt?: Tier;                     // SE9: a look over the wearer must beat this tier to spot it
  visible?: true;                      // accessories: shown to others
  slot?: 'armor' | 'accessory';
  grips?: 1 | 2;
  effects?: ItemEffect[];
  weapon?: { modes: AttackMode[] };
  armor?: { covers: string[]; reduction: number; multiplier: number;
            weight: ArmorWeightKey;   // ARMOR_WEIGHTS: light, medium, heavy
            pools?: Record<string, number> };   // part id -> pool in points, the same for every wearer
  shield?: { pool: number };                     // pool in points, the same in any hand
  base?: { itemId: LibraryRef; quality: 1 | 2 | 3 | 4; boosts: string };   // minted variants
  tags?: string[];
};

type ItemEffect = {
  kind: 'skill' | 'rollMod';           // rollMod only when the entry notes it
  skill?: LibraryRef;                  // kind 'skill'
  roll?: 'hit' | 'dodge' | 'block' | 'perception' | 'stealth' | 'event';   // kind 'rollMod'
  value: number;
  active: 'worn' | 'held' | 'inUse' | 'carried';
  scope: 'withItem' | 'any';
};

type AttackMode = {
  id: string;
  tree: 'melee' | 'ranged' | 'unarmed';
  class: 'light' | 'medium' | 'heavy' | 'punch' | 'slam' | 'grapple';   // natural attacks use their own class; unarmed with no class: the unarmed profile
  skill?: LibraryRef;                    // unarmed only: which placeholder skill
  reachM: number;                        // metres, from real weapons
  reach: number;                         // metres in use: reachM + a thrown weapon's perk metres (modeReach)
  grips: 0 | 1 | 2;                      // 0 for natural attacks
  thrown?: true;
  damageAdj?: number;
  hitAdj?: number;
  partId?: string;                       // natural attacks: the Strike part used
};

// ---------- story control ----------
type StoryMeta = {
  storyId: StoryId;
  title: string;
  schemaVersion: number;
  createdAt: string;        // ISO date
  settings: { showMechanics: boolean; tone: string };
};

type PageRef = { version: Turn; hash: string; bytes: number };
type Bookmark = { turn: Turn; pages: Record<string, PageRef> };   // page key -> version

type Head = Bookmark & {    // writing this is the commit
  storyId: StoryId;
  schemaVersion: number;
  libraryVersion: number;
  undo: Bookmark | null;    // one turn back
  safety?: Bookmark;        // pre-migration, dropped after the next good turn
};

// ---------- pages ----------
type EnginePage = {
  storyId: StoryId;
  turn: Turn;
  mode: 'explore' | 'dialogue' | 'tactical';
  rngSeed: number;
  rngState: number;         // NOT restored by undo
  pending: { turn: number; mode: 'explore' | 'dialogue' | 'tactical'; engaged: string[]; fired: string[] };
  stage: {
    tier: Tier;             // this scenario's event-roll tier
    scenarioNumber: number;
    scenarioStartTurn: Turn;
    fallback?: { reason: string; turn: Turn };   // set when the fallback stage was used
  };
  scenarioCaps: { promotions: number; minted: number };   // reset at scenario start
  clocks: Record<string, number>;
  bands: Band[];
  quests: Quest[];   // src/types/state.ts: id, state, text, giver, dealId, goal, progress, level, startTurn, after?, pay?, due?, pinned?
};

type HiddenPage = { storyId: StoryId } & HiddenStore;

type BlueprintPage = {
  storyId: StoryId;
  id: LibraryRef;
  kind: 'item' | 'body_type' | 'npcTemplate';
  data: Record<string, unknown>;   // same shape as the library entry of that kind
};

// ---------- actor ----------
type NameHistory = { current: string; past: { name: string; untilTurn: Turn }[] };

type Actor = {
  id: ActorId;
  storyId: StoryId;
  kind: 'player' | 'npc';
  names: NameHistory;
  label: string;                     // public stranger label, e.g. 'a scarred dockhand'
  knownOnSight?: boolean;            // name known without an introduction
  placeId: PlaceId;                  // always the place of `zone`
  zone: string;                      // zone id (Part 2)
  posture?: 'open' | 'stealthy';     // player only (Part 2)
  bandId: string;                    // moved from Mind; the player belongs to the player band
  core: Core;
  progression?: Progression;         // player; NPCs only if NPCs improve (deferred)
  mind?: Mind;                       // NPCs
  journal?: Journal;                 // player
};

type SkillState = 'tagged' | 'normal' | 'flawed';
type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

type Core = {
  raceId?: LibraryRef;               // absent for actors with no race
  bodyTypeId: LibraryRef;        // body plan; set by the race when there is one
  templateId?: LibraryRef;           // NPCs: the template it came from
  generation?: 'rolled' | 'copy';    // rolled: values below are frozen; copy: skills read from the template
  skills: Record<LibraryRef, SkillEntry>;
  classes: ClassEntry[];
  perks: OwnedPerk[];                // stored perks only; race and class perks are derived
  condition: SavedCondition;
  inventory: ItemInstance[];
  standingDefense: 'dodge' | 'block';   // Part 2, Agent Planner; default [Proposed]: the higher effective skill
};

type ClassEntry = {
  classId: LibraryRef;
  state: 'unlocked' | 'current' | 'previous';   // exactly one 'current'
  level: number;                                // class level; 0 while unlocked
  dormant?: boolean;
};

type OwnedPerk = {
  perkId: LibraryRef;
  source: 'level' | 'mastery';       // 'mastery' = all-XXX perks, never removed
  gainedTurn: Turn;
  treeId?: LibraryRef;               // mastery only
  tier?: 50 | 100 | 150;             // mastery only
  dormant?: boolean;                 // set on load when the library entry is deleted
};

type SavedCondition = {
  hpLostPct: number;                 // health-track level is derived from this
  parts: Record<string, number>;     // body-part id -> pool %, state derived
  destroyed?: string[];              // reserved: Destroyed latch, pending Healing
  status: string[];
};

type ItemInstance = {
  id: string;
  itemId: LibraryRef;
  qty?: number;                      // stackables only
  equippedIn?: string[];             // 'grip:<grip part id>' | 'armor' | 'acc:<n>'; absent = carried
  pools?: Record<string, number>;    // % left: 'shield', or a covered part id
};

type Progression = {
  startingTotal: number;             // record only; never changes
  potential: { base: number; adjustments: { source: string; delta: number; turn: Turn }[] };   // base: POTENTIAL, or this character's own value
  xp: number;                        // toward the next level
  unspentPerkPoints: number;
  marks: LibraryRef[];
  xpLog?: { source: string; amount: number; turn: Turn; levelUp?: { classId: LibraryRef; level: number } }[];   // source trail (B8)
  achievements?: { id: string; key: string; of?: string; turn: Turn }[];   // each once (B4); name and level read from the library row `key`
  defeats?: Record<string, number>;   // 'all', 'body_type:<type>', 'race:<race>'
  nextClass?: LibraryRef;            // the class the next level goes to (X9)
};

type Mind = {
  control: 'agent' | 'code';
  moraleState?: 'broken' | 'surrendered';   // set when the morale bar reaches Broken (Part 3, Morale); cleared when the scenario ends
  knowledge: Record<ActorId, Belief>;
  overrides?: Record<ActorId, 'hostile' | 'opposed' | 'neutral' | 'friendly'>;  // sparse; else band relations
  knows: Fact[];
  routine?: { id: string; anchorTurn: Turn };            // anchor set by code (Part 2, Anchors); zone removed
  routines?: string[];                                   // the routine set's routines; player band: the companion set
  routineSetId?: LibraryRef;                             // the set those routines came from
  slots?: Record<string, string | string[]>;             // slot -> zone id, or zone ids for a route;
                                                         // shared by every routine in `routines`;
                                                         // 'here' is written by code on a switch to a wait routine
  alarm?: { armed: boolean; lastAlarmTurn?: Turn;
            returnTo?: { id: string; anchorTurn: Turn } };   // set on alarm, cleared on calm or an agent switch
};
// Removed from Mind: the old group id (now Actor.bandId) and hasAgenda (derived).

type NpcTemplate = {                 // library entry or story blueprint (kind 'npcTemplate'); Part 4 §4
  id: LibraryRef;
  bodyTypeId: LibraryRef;
  raceId?: LibraryRef;
  classId?: LibraryRef;              // its class tree, e.g. 'slime'
  generation: 'rolled' | 'copy';
  minimums: Record<LibraryRef, number>;   // skill -> starting raw; absent = 0
  roleId?: LibraryRef;               // NG1: role (RO), its skills in High / Moderate / Low bands
  themeId?: LibraryRef;              // NG1: theme (TH), extra bands and rank names
  rank?: RankKey;                    // NG3: rank row (RANK_ROWS) sets the skill anchor, the level and the training years (AG12)
  talent?: TalentKey;                // AG25: sets the youngest age for the rank; left out = the theme's, then NPC_TALENT_DEFAULT
  level?: number;                    // uniques (echoes) only; presets take level from the rank row
  resolve: number;                 // starting Resolve (Part 3, Morale)
  personality: Personality;        // Nerve, trait and value points (Part 4, Personality)
  loadout?: LibraryRef[];            // [Proposed] items given at spawn (Part 5 §8)
  potential?: number;                // overrides POTENTIAL for NPCs made from it
  control: 'agent' | 'code';
  label: string;                     // public stranger label
};

type Journal = {
  secretsKnown: string[];
  factsWitnessed: FactId[];
  remembered: Record<SlotKey, { value: string; seenTurn: Turn }>;
  namesKnown: ActorId[];             // actors the player knows by name
  clearSight?: Record<ActorId, ZoneId>; // actors seen clearly and where; kept until they move unseen (Q17)
  lastKnown?: Record<ActorId, ZoneId>; // where each actor was last seen or heard; never forgotten (BG-28)
};

// ---------- places and memory ----------
type Place = {
  id: PlaceId;
  storyId: StoryId;
  kind: string;                      // 'country' | 'settlement' | 'place' | ...
  parentId: PlaceId | null;
  names: NameHistory;
  zones: Zone[];                     // Zone and ZoneLink from Part 2
  state: Record<SlotKey, { value: string; setTurn: Turn; setBy: string }>;
  headlines: FactId[];               // facts promoted to this node
};

type StoryFact = {
  id: FactId;
  storyId: StoryId;
  placeId: PlaceId;                  // where it happened
  turn: Turn;
  text: string;                      // past tense; '{npc:leona}' refs, never names
  refs: string[];                    // linked entity ids
  source: 'rule' | 'proposal';
  promotedTo: PlaceId[];
};

type FactsPage = { storyId: StoryId; placeId: PlaceId; facts: StoryFact[] };

// ---------- turn record ----------
type TurnRecord = {
  storyId: StoryId;
  turn: Turn;
  libraryVersion: number;            // exact replay only under this version
  rngBefore: number;
  playerInput: string;
  agentLog: AgentTurnLog[];
  events: GameEvent[];
  factsAdded: FactId[];
  eventRoll?: EventRollResult;       // set on the turn that started a scenario
};
```
