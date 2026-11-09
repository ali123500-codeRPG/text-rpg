// In-memory GameState (Part 2) and saved pages (Part 4 §9).
import type { ActorId, Band, FactId, GameEvent, LibraryRef, LogEntry, Mode, PlaceId, SlotKey, StoryId, Tier, Turn, Zone } from './core';
import type { Actor, NameHistory } from './actor';
import type { HiddenStore } from './hidden';
import type { SituationResult } from './ruleset';
import type { AgentTurnLog } from './agents';
import type { QuestRewardLevel, TimeOfDay } from '../scales';

export type Pending = { turn: number; mode: Mode; engaged: string[]; fired: string[] };

export type StageInfo = {
  zoneIds: string[];
  tier: Tier;
  sceneNumber: number;
  sceneStartTurn: Turn;
  fallback?: { reason: string; turn: Turn };
  routineFallback?: { actors: string[]; turn: Turn };
  quiet?: number; // P7: quiet turns in a row (no attack, nothing new learned, no beat)
  breakCause?: 'rest' | 'story_beat' | 'time_skip'; // P7: set by the engine; the director starts a new scene after this turn
  /** OQ-27 (c): the NPC the player last spoke with this scene (sticky dialogue partner) */
  partner?: string;
};

export type Settings = { difficulty: string; showMechanics: boolean; tone: string };
/** QT11/QT21: quest states and goal kinds are unordered categories, so their names are their IDs */
export const QUEST_STATES = ['active', 'ready', 'done', 'failed', 'abandoned', 'called_off'] as const;
export type QuestState = (typeof QUEST_STATES)[number];
export const GOAL_KINDS = ['defeat', 'deliver', 'reach', 'find', 'other'] as const;
/** QT7: what code checks from events; "other" is judged by the giver's agent at report-back (QT6) */
export type QuestGoal =
  | { kind: 'defeat'; by: 'body_type' | 'race' | 'actor'; of: string; count: number }
  | { kind: 'deliver'; item: string; inst?: true; qty: number; to: string } // inst: item is one item instance, not a library item
  | { kind: 'reach'; place: string } // a zone or place id
  | { kind: 'find'; actor: string }
  | { kind: 'other' };
/** QT1: a job an NPC gave the player, held in a deal (dealId) that only code ends */
export type Quest = {
  id: string; state: QuestState; text: string;
  giver: string; dealId: string; goal: QuestGoal; progress: number;
  level: QuestRewardLevel; // QT9/QT28: from the scene's gain grade when accepted
  startTurn: number; endTurn?: number;
  after?: string; // QT24: the quest it follows
  pay?: { coin?: number; item?: string; qty?: number }; // QT10/QT23: promised payment (coin in copper, a library item)
  paid?: { coin: number; qty: number }; // what the giver has handed over since
  unpaid?: true; // the promise was broken
  due?: number; dueBy?: TimeOfDay; // QT25: game clock minutes the goal must be met by; dueBy: the time of day named
  pinned?: true; // shown on the Play screen's quest line
};

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
  facts: StoryFact[];
  stage: StageInfo;
  sceneCaps: { promotions: number; minted: number };
  clocks: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  quests: Quest[];
  settings: Settings;
  libraryVersion: number;
  blueprints: BlueprintPage[]; // story blueprints (story first, then library)
  meta: StoryMeta;
  /** derived per turn, never saved: actor id -> ids of actors that hit it this scene (latest last) */
  scratch?: Record<string, unknown>;
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
};

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
  sceneCaps: { promotions: number; minted: number };
  clocks: Record<string, number>;
  flags: Record<string, string | number | boolean>;
  bands: Band[];
  quests: Quest[];
  /** NPC view history (GameState.recentEvents); absent in older saves */
  recentEvents?: GameEvent[];
  /** W1: in-memory order of actors and places (the store may not keep object key order) */
  order?: { actors: string[]; places: string[] };
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
  situation?: SituationResult;
  log?: LogEntry[];
  aimed?: boolean;
  /** save schema the record was written under (absent before v5) */
  schemaVersion?: number;
};

export type { ActorId };
