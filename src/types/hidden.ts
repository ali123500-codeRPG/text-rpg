// Part 2, Hidden state persistence; routines from Game state model.
import type { Grade, Tier } from './core';
import type { Order } from './ruleset';

export type HiddenStore = {
  plans: Record<string, Plan>; // actorId -> plan
  memory: Record<string, string>; // actorId -> memory note
  secrets: Secret[];
  firedLog: { triggerId: string; turn: number; ownerId?: string }[];
  weaverNote: string;
  stage: { eventSummary: string; challenge: Grade; gain: Grade; hiddenTerms: string[] };
  /** W6: per-actor hidden Weaver text (motive, routineGap); GM view only. Not an agenda (hasAgenda ignores it). */
  castNotes?: Record<string, { motive: string; routineGap?: string }>;
};

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
};
export type ActivityDef = {
  id: string;
  look: string;
  attention: 'alert' | 'normal' | 'distracted' | 'asleep';
  noise: 0 | 1 | 2 | 3;
  visibility: 0 | 1 | 2 | 3;
};
