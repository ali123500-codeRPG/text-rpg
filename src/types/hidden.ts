// Part 2, Hidden state persistence; routines from Game state model.
import type { Grade, Tier } from './core';
import type { Order } from './ruleset';
import type { NoiseKey, SceneScale, VisibilityKey } from '../scales';

export type HiddenStore = {
  plans: Record<string, Plan>; // actorId -> plan
  memory: Record<string, MemoryEntry[]>; // actorId -> memory list (PM1, at most CONFIG.MEMORY_ENTRIES)
  /** PM3/PM4: deals between two actors (the player or NPCs), kept until done or broken */
  agreements?: Agreement[];
  secrets: Secret[];
  firedLog: { triggerId: string; turn: number; ownerId?: string }[];
  weaverNote: string;
  stage: { eventSummary: string; challenge: Grade; gain: Grade; hiddenTerms: string[] };
  /** W6: per-actor hidden Weaver text (motive, routineGap); GM view only. Not an agenda (hasAgenda ignores it). */
  castNotes?: Record<string, { motive: string; routineGap?: string }>;
  /** SC6: how each scene went, oldest first (CONFIG.SCENE_RECORDS_SAVED kept); the next Weaver gets the last few */
  scenes?: SceneRecord[];
};

/** SC10: how a scene ended. An unordered category, so the names are the IDs (display names: SCENE_ENDING_NAMES). */
export const SCENE_ENDINGS = ['resolved', 'lost', 'left', 'escaped', 'interrupted', 'worn_out', 'broken_off'] as const;
export type SceneEnding = (typeof SCENE_ENDINGS)[number];
export const SCENE_ENDING_NAMES: Record<SceneEnding, string> = {
  resolved: 'resolved', lost: 'lost', left: 'left', escaped: 'escaped', interrupted: 'interrupted', worn_out: 'worn out', broken_off: 'broken off',
};
/** SC7: what code checks to end a scene, reusing the quest goal checks (src/engine/quests.ts): a band is all down, broken
 * or gone; the player reaches or leaves a place or zone; the player finds someone or holds an item; an item is given to
 * someone; a time of day comes. "judged" is for anything code cannot check: the Weaver check-in decides it. */
export type EndCheck =
  | { kind: 'band_out'; band: string }
  | { kind: 'reach'; place: string }
  | { kind: 'leave'; place: string }
  | { kind: 'find'; actor: string }
  | { kind: 'hold'; item: string }
  | { kind: 'deliver'; item: string; to: string }
  | { kind: 'time'; at: string }
  | { kind: 'judged' };
/** one way the scene can end: what code checks, which ending it is, and a hidden line saying what it means */
export type PlanEnding = { when: EndCheck; as: Exclude<SceneEnding, 'worn_out' | 'broken_off'>; text: string };
/** SC1/SC2/SC7: the scene's hidden question, its scale and its endings */
export type SceneFrame = {
  question: string; scale: SceneScale; endings: PlanEnding[];
  tier: Tier; startTurn: number; startMinute: number; number: number;
  /** who was up and what the player held at the start, for the record */
  upAtStart: string[]; heldAtStart: string[];
  /** places a 'leave' ending names that the player has been in this scene (leaving needs being there first) */
  beenIn?: string[];
};
/** SC6: how one scene went */
export type SceneRecord = {
  number: number; question: string; scale: SceneScale; tier: Tier;
  ending: SceneEnding; text: string; startTurn: number; endTurn: number;
  fallen: string[]; gained: string[]; inner?: true;
};

export type MemoryEntry = { turn: number; text: string };
export type Agreement = { id: string; parties: [string, string]; text: string; madeTurn: number; madeBy: string };

export type Plan = { goal: string; steps: string[]; triggers: Trigger[]; createdTurn: number };

export type TriggerWhen =
  | { type: 'player_seen_in_zone'; zone: string }
  | { type: 'turn_reached'; turn: number }
  | { type: 'actor_down'; actorId: string }
  | { type: 'alarm_heard' }
  | { type: 'quiet_turns'; turns: number }; // a beat (P7): holds once the scene has been quiet this many turns in a row

export type Trigger = {
  id: string;
  ownerId: string;
  when: TriggerWhen;
  then: OrderTemplate;
  once: boolean;
  endsScene?: true; // P7 S2: when it fires, the scene ends (sceneBreak story_beat)
};

export type OrderTemplate = Omit<Order, 'source' | 'target' | 'actorId'> & {
  actorId?: string;
  target: string | '$player' | '$lastKnownZone' | '$triggerZone' | `$slot:${string}` | null;
};

export type Secret = {
  id: string;
  holderId: string;
  fact: string;
  leakTerms: string[];
  revealWhen:
    | { type: 'event_in_zone'; kind: string; zone: string }
    | { type: 'check_passed'; skill: string; minTier: Tier; againstActorId: string };
};

// ---- routine bank (library content) ----
export type DurationId = 'brief' | 'short' | 'medium' | 'long';
export type RoutineSet = {
  id: string;
  brief: string;
  tags: { place: string[]; role: string[]; time: ('day' | 'night' | 'any')[]; event: string[] };
  slots: Record<string, { kind: 'zone' | 'route'; hint: string }>;
  routines: string[]; // [default, ...others]
};
export type RoutineStep = { slot: string; duration: DurationId; activity: string };
export type Routine = {
  id: string;
  brief: string;
  kind: 'schedule' | 'follow' | 'wait';
  loop: boolean;
  steps: RoutineStep[]; // schedule only; [] otherwise
  activity?: string; // follow and wait only
  alert?: string;
  onAlert: OrderTemplate | null;
  posture?: 'stealthy'; // NS: the actor keeps stealthy while on this routine (the thief's prowl)
};
export type ActivityDef = {
  id: string;
  look: string;
  attention: 'alert' | 'normal' | 'distracted' | 'asleep';
  noise: NoiseKey;
  visibility: VisibilityKey;
};
