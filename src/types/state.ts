// In-memory GameState (Part 2) and saved pages (Part 4 §9).
import type { ActorId, Band, FactId, GameEvent, LibraryRef, LogEntry, Mode, PlaceId, SlotKey, StoryId, Tier, Turn, Zone } from './core';
import type { Actor, NameHistory } from './actor';
import type { HiddenStore } from './hidden';
import type { SituationResult } from './ruleset';
import type { AgentTurnLog } from './agents';

export type Pending = { turn: number; mode: Mode; engaged: string[]; fired: string[] };

export type StageInfo = {
  zoneIds: string[];
  tier: Tier;
  sceneNumber: number;
  sceneStartTurn: Turn;
  fallback?: { reason: string; turn: Turn };
  routineFallback?: { actors: string[]; turn: Turn };
  /** OQ-27 (c): the NPC the player last spoke with this scene (sticky dialogue partner) */
  partner?: string;
};

export type Settings = { difficulty: string; showMechanics: boolean; tone: string };
export type Quest = { id: string; state: string; text: string };

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
  /** W1: in-memory order of actors and places (the store may not keep object key order) */
  order?: { actors: string[]; places: string[] };
};

export type HiddenPage = { storyId: StoryId } & HiddenStore;

export type BlueprintPage = {
  storyId: StoryId;
  id: LibraryRef;
  kind: 'item' | 'creature' | 'npcTemplate';
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
};

export type { ActorId };
