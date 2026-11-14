// In-memory GameState (Part 2) and saved pages (Part 4 §9).
import type { ActorId, Band, FactId, GameEvent, LibraryRef, LogEntry, Mode, PlaceId, SlotKey, StoryId, Tier, Turn, Zone } from './core';
import type { Actor, NameHistory } from './actor';
import type { HiddenStore } from './hidden';
import type { EventRollResult } from './ruleset';
import type { AgentTurnLog } from './agents';
import type { QuestRewardLevel, TimeOfDay } from '../scales';

export type Pending = { turn: number; mode: Mode; engaged: string[]; fired: string[] };

export type StageInfo = {
  zoneIds: string[];
  tier: Tier;
  /** steps the scenario's event roll went past its Critical tier (an achievement opened them) */
  tierBeyond?: number;
  scenarioNumber: number;
  scenarioStartTurn: Turn;
  /** GD1 b: library item ids a guard is after in this scenario (the Weaver's forbidden goods: weapons in a temple, smuggled wares at a gate) */
  forbidden?: string[];
  fallback?: { reason: string; turn: Turn };
  routineFallback?: { actors: string[]; turn: Turn };
  quiet?: number; // P7: quiet turns in a row (no attack, nothing new learned, no beat)
  /** P7: set by the engine; the director starts a new scenario after this turn (knocked_out: D-54, the player wakes somewhere
   * safe; scenario_end: one of the scenario's endings was met, SC7). Rest, sleep and time skips never end a scenario (SC4, SC9). */
  breakCause?: 'story_beat' | 'knocked_out' | 'encounter' | 'scenario_end' | 'roam';
  /** SC1/SC2/SC7: the scenario's question, scale and endings (absent before the first scenario, or on an old save) */
  scenario?: import('./hidden').ScenarioFrame;
  /** SC4: the bigger scenario (Episode or Venture) this one sits inside, one level deep; it carries on when this one ends */
  outer?: import('./hidden').ScenarioFrame;
  /** SC7/SC13: an ending that was met, waiting for a clear turn (no fight, chase or talk) before it ends the scenario */
  ending?: { as: import('./hidden').ScenarioEnding; text: string; outer?: true; turn: number; roam?: true };
  /** SC10: how the scenario that just ended ended, set with breakCause and recorded when the next one begins */
  ended?: { as: import('./hidden').ScenarioEnding; text: string; outer?: true; roam?: true };
  /** SD1: how the last scenario ended and the turn it was closed (the play page's ending moment reads it that turn) */
  /** D-226: the gains of the scenario that ended on `turn` (the ending moment's summary; GameApi scenarioEnding().gains) */
  gains?: import('./game').ScenarioGains & { number: number; turn: number };
  closed?: { as: import('./hidden').ScenarioEnding; turn: number };
  /** SD2 a: free roam, since this turn: no scenario runs until danger starts one or a window opens (WB5, WB6) */
  roam?: { since: number;
    /** WB6/WB7: the game minute free roam began, the rest after the scenario that ended (ROAM_REST_MIN by its challenge), and
     * the minute the Weaver last declined a window */
    sinceMin?: number; rest?: number; declinedAt?: number;
    /** SW3 a: what happened in this free roam, one short hidden line per notable thing (as a scenario's `happened`, plus attacks) */
    happened?: { turn: number; text: string }[] };
  /** SW3 a: why free roam is ending in a scenario (danger, or a window the Weaver took), what happened in the roam and who saw
   * the player that turn; read by the window's and the next scenario's Weaver views, cleared once that plan is applied */
  cause?: { why: string; happened: { turn: number; text: string }[]; seenBy: string[] };
  /** WB6: a scenario window is open (cause holds why): due, the Weaver is asked after the save; asked, its answer is awaited (a
   * reload asks again). No other window opens meanwhile; the Weaver may decline */
  window?: 'due' | 'asked';
  /** BG-238: danger started a scenario in free roam on `turn`: the turn ended without waiting, with this event roll; the Weaver
   * plans it in the background and it starts after the next turn (free roam goes on meanwhile; nothing else starts one) */
  starting?: { turn: number; eventRoll: EventRollResult };
  /** BG-217: growth earned in free roam waits for the next scenario's end: where the XP stood when the roam began, taken by
   * the next scenario's frame so its gains moment counts the roam's XP too */
  roamGrowth?: { xpFrom: number; xpStart: { level: number; pct: number } };
  /** CH6: frontiers the player crossed during the current chase: from the zone before it to the zone it led to */
  crossings?: { from: string; to: string; turn: number }[];
  /** SC8: a Weaver check-in is due after this turn is saved, and why */
  checkinDue?: import('./hidden').CheckinReason;
  /** SC8: the turn a beat (a quiet_turns trigger) last fired */
  beatTurn?: number;
  /** TV4: an encounter on the road: its event roll (the next scenario's tier), whether the player saw it coming (TV8), and
   * where on the road it stands; cleared at the start of the next turn */
  encounter?: { eventRoll: import('./ruleset').EventRollResult; noticed: boolean; zone: string; at: { x: number; y: number } };
  /** OQ-27 (c): the NPC the player last spoke with this scenario (sticky dialogue partner) */
  partner?: string;
};

export type Settings = { showMechanics: boolean; tone: string };
/** QT11/QT21: quest states and goal kinds are unordered categories, so their names are their IDs */
export const QUEST_STATES = ['active', 'ready', 'done', 'failed', 'abandoned', 'called_off'] as const;
export type QuestState = (typeof QUEST_STATES)[number];
export const GOAL_KINDS = ['defeat', 'deliver', 'reach', 'find', 'other'] as const;
/** BF61: the kinds a giver may offer: only those code can check; "other" stays for jobs already made */
export const OFFERED_GOAL_KINDS = ['defeat', 'deliver', 'reach', 'find'] as const;
/** QT7: what code checks from events; "other" is judged by the giver's agent at report-back (QT6) */
export type QuestGoal =
  | { kind: 'defeat'; by: 'body_type' | 'race' | 'actor'; of: string; count: number; noun?: string } // noun: the giver's word for them
  | { kind: 'deliver'; item: string; inst?: true; qty: number; to: string } // inst: item is one item instance, not a library item
  | { kind: 'reach'; place: string } // a zone or place id
  | { kind: 'find'; actor: string }
  | { kind: 'other' };
/** QT1: a job an NPC gave the player, held in a deal (dealId) that only code ends */
export type Quest = {
  id: string; state: QuestState; text: string;
  giver: string; dealId: string; goal: QuestGoal; progress: number;
  /** defeat goals: summed power of the counted foes, each taken when it fell (QX2/QX4) */
  foePower?: number;
  /** BF6: the giver perceived the goal being met (it saw the kill, the hand-over, the player get there); else it learns
   * only by believing the player's report (its agent's questEnd done) */
  giverSaw?: boolean;
  level: QuestRewardLevel; // QT9/QT28: from the scenario's gain grade when accepted
  startTurn: number; endTurn?: number;
  startAt?: number; // game clock minutes when it was given (set with `due`: the 'quests_early' achievement)
  after?: string; // QT24: the quest it follows
  pay?: { coin?: number; item?: string; qty?: number }; // QT10/QT23: promised payment (coin in copper, a library item)
  paid?: { coin: number; qty: number }; // what the giver has handed over since
  unpaid?: true; // the promise was broken
  due?: number; dueBy?: TimeOfDay; // QT25: game clock minutes the goal must be met by; dueBy: the time of day named
  pinned?: true; // shown on the Play screen's quest line
};

/** SP1/SP3: a spar between sides (one actor each for one against one; every actor on its own side for a free-for-all).
 * out: who has yielded or reached the limit (SP4, SP5), with the turn; last: the turn of the latest blow between sides (or the start). */
export type Spar = { id: string; sides: string[][]; cruel?: true; start: number; last: number; out: Record<string, number> };
/** MB40–MB43: the player's yield this scenario: foes yet to answer, those that took it (truce) and those that fought on */
export type PlayerYield = { turn: number; pending: string[]; accepted: string[]; refused: string[]; ended?: boolean }; // ended: YD3, the fight already ended on it
/** TF13–TF16: offers to stand down in a fight this scenario: those an AI-run listener (or the player) has yet to answer,
 * and the stand-down truces, each actor id to those it may no longer attack nor be attacked by (cleared at scenario end) */
export type StandDownOffer = { from: string; to: string; landed: 'convinced' | 'tempted' | 'unmoved'; turn: number; heard: string[]; coin?: number; demand?: 'yield' }; // demand: TF19, it asks for surrender (answered by yields)
export type StandDowns = { pending: StandDownOffer[]; truces: Record<string, string[]> };
/** D-239: the player is down in a lethal fight and foes decide, in their next output, whether to finish or spare (acceptYield's shape) */
export type PlayerMercy = { turn: number; pending: string[]; spared: string[]; finish: string[] };

// In-memory working state, built from Part 4's pages on load. Never saved as one document.
export type GameState = {
  storyId: StoryId;
  turn: number;
  mode: Mode;
  zones: Zone[]; // the stage: same objects as in places[].zones
  player: Actor;
  actors: Actor[]; // NPCs and enemies (never the player)
  bands: Band[];
  hidden: HiddenStore; // never enters the Parser's, Narrator's or Voice's input
  events: GameEvent[]; // this turn's events
  agentLog: AgentTurnLog[]; // this turn's agent inputs and outputs
  log: LogEntry[]; // this turn's engine log codes (routine_skip, invalid_routine, weaver_fallback, ...)
  rngSeed: number;
  rngState: number;
  pending: Pending;
  // engine page fields
  places: Place[];
  /** WZ1 the world's land, region by region, as code drew it (src/land) */
  regions?: import('./core').Region[];
  facts: StoryFact[];
  stage: StageInfo;
  scenarioCaps: { promotions: number; minted: number };
  clocks: Record<string, number>;
  /** AT15: game minutes each recent turn ended, by turn (time.ts turnTime): timers count game time from turn stamps */
  turnEnds?: Record<number, number>;
  flags: Record<string, string | number | boolean>;
  quests: Quest[];
  spars?: Spar[]; // SP1: live spars (public: anyone who sees a sparring blow knows it is a spar)
  yielding?: PlayerYield; // MB40: cleared when the scenario ends
  offers?: StandDowns; // TF13–TF16: cleared when the scenario ends
  mercy?: PlayerMercy; // D-239: settled the turn after the player went down
  barriers?: Record<string, import('./core').Barrier>; // SD3–SD5: doors, gates, grates and rubble on ways, by id
  settings: Settings;
  libraryVersion: number;
  blueprints: BlueprintPage[]; // story blueprints (story first, then library)
  meta: StoryMeta;
  /** derived per turn, never saved: actor id -> ids of actors that hit it this scenario (latest last) */
  scratch?: Record<string, unknown>;
  /** NW12/NW15: the player's night: who sleeps when (one watch each when the player sleeps with companions) */
  night?: Night;
  /** never saved: earlier turns' events, pruned to each actor's last RECENT_EVENTS perceived ones, so NPC views keep what they saw and heard */
  recentEvents?: GameEvent[];
};

export type LibraryMeta = { libraryVersion: number; status: Record<LibraryRef, EntryStatus> };
export type EntryStatus =
  | { state: 'active' }
  | { state: 'renamed'; to: LibraryRef }
  | { state: 'replaced'; by: LibraryRef }
  | { state: 'deleted' };

export type StoryMeta = {
  storyId: StoryId;
  title: string;
  schemaVersion: number;
  createdAt: string;
  settings: Settings;
  /** set by a confirmed reset (D-73): the story's pages stay under its id, but play no longer loads it */
  archivedAt?: string;
  /** whose story it is: absent = the player's; 'agent' = the autopilot's own save. One story per owner runs at a time. */
  owner?: StoryOwner;
  /** hall of fame: the character as they fell, written when a fallen story is archived */
  fame?: FameEntry;
  /** HF31: how the story ended, written by a reset: the character, the day, and the Threadbound items left in the world */
  end?: { name: string; day: number; threadbound: string[] };
  /** HF25: the world this story carries on (absent: the story began a world of its own, whose id is its storyId) */
  worldId?: string;
};
/** a fallen character, kept for the hall of fame (names, not ids, so it reads the same if the library changes) */
export type FameEntry = {
  name: string; pronouns?: string; title?: string;
  classes: { name: string; level: number }[]; level: number;
  skills: { name: string; value: number }[]; // the highest true skills, best first
  perks: string[]; achievements: string[]; scars: string[];
  defeats: number; turn: number; day: number; place: string;
  downedBy?: import('./game').DownedBy;
  fellAt: string; // ISO time the story was archived
};
export type StoryOwner = 'player' | 'agent';

export type PageRef = { version: Turn; hash: string; bytes: number };
export type Bookmark = { turn: Turn; pages: Record<string, PageRef> };
export type Head = Bookmark & {
  storyId: StoryId;
  schemaVersion: number;
  libraryVersion: number;
  undo: Bookmark | null;
  safety?: Bookmark;
};

export type EnginePage = {
  storyId: StoryId;
  turn: Turn;
  mode: Mode;
  rngSeed: number;
  rngState: number;
  pending: Pending;
  stage: StageInfo;
  scenarioCaps: { promotions: number; minted: number };
  clocks: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  bands: Band[];
  quests: Quest[];
  spars?: Spar[];
  yielding?: PlayerYield;
  offers?: StandDowns;
  mercy?: PlayerMercy;
  barriers?: Record<string, import('./core').Barrier>;
  turnEnds?: Record<number, number>;
  /** NPC view history (GameState.recentEvents); absent in older saves */
  recentEvents?: GameEvent[];
  /** W1: in-memory order of actors and places (the store may not keep object key order) */
  order?: { actors: string[]; places: string[]; regions?: string[] };
};

export type HiddenPage = { storyId: StoryId } & HiddenStore;

export type BlueprintPage = {
  storyId: StoryId;
  id: LibraryRef;
  kind: 'item' | 'body_type' | 'npcTemplate';
  data: Record<string, unknown>;
};

export type Place = {
  id: PlaceId;
  storyId: StoryId;
  kind: string;
  parentId: PlaceId | null;
  names: NameHistory;
  zones: Zone[];
  state: Record<SlotKey, { value: string; setTurn: Turn; setBy: string }>;
  headlines: FactId[];
  /** WZ1 the region site this place stands on (a top-level settlement); its zones are placed there */
  site?: string;
  /** a bare node made for the story start before any plan (ensurePlace); the first plan's place of the same key fills it in (BG-32) */
  bare?: true;
};

export type StoryFact = {
  id: FactId;
  storyId: StoryId;
  placeId: PlaceId;
  turn: Turn;
  text: string;
  refs: string[];
  source: 'rule' | 'proposal';
  promotedTo: PlaceId[];
};
export type FactsPage = { storyId: StoryId; placeId: PlaceId; facts: StoryFact[] };

export type TurnRecord = {
  storyId: StoryId;
  turn: Turn;
  libraryVersion: number;
  rngBefore: number;
  playerInput: string;
  agentLog: AgentTurnLog[];
  events: GameEvent[];
  factsAdded: FactId[];
  eventRoll?: EventRollResult;
  log?: LogEntry[];
  aimed?: boolean;
  /** the story's opening (scenario setup alone); a carried-on world's story opens after the world's last turn (HF26) */
  opening?: true;
  /** save schema the record was written under (absent before v5) */
  schemaVersion?: number;
};

export type { ActorId };

/** NW15/NW22: a night's plan. Each member sleeps from start to end except during its own watch [from, to); slept counts
 * the player's minutes asleep for the rest heal; woke lists members woken out of the plan (their night is over). */
export type Night = { start: number; end: number; members: string[]; watches: { actorId: string; from: number; to: number }[]; slept: number; heals: number; woke: string[] };
