// Part 2, Hidden state persistence; routines from Game state model.
import type { Grade, Tier } from './core';
import type { Order } from './ruleset';
import type { NoiseKey, ScenarioScale, VisibilityKey } from '../scales';

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
  /** SC6: how each scenario went, oldest first (CONFIG.SCENARIO_RECORDS_SAVED kept); the next Weaver gets the last few */
  scenarios?: ScenarioRecord[];
};

/** SC10: how a scenario ended. An unordered category, so the names are the IDs (display names: SCENARIO_ENDING_NAMES). */
export const SCENARIO_ENDINGS = ['resolved', 'lost', 'left', 'escaped', 'interrupted', 'worn_out', 'broken_off'] as const;
export type ScenarioEnding = (typeof SCENARIO_ENDINGS)[number];
export const SCENARIO_ENDING_NAMES: Record<ScenarioEnding, string> = {
  resolved: 'resolved', lost: 'lost', left: 'left', escaped: 'escaped', interrupted: 'interrupted', worn_out: 'worn out', broken_off: 'broken off',
};
/** SC7: what code checks to end a scenario, reusing the quest goal checks (src/engine/quests.ts): a band is all down, broken
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
/** one way the scenario can end: what code checks, which ending it is, and a hidden line saying what it means */
export type PlanEnding = { when: EndCheck; as: Exclude<ScenarioEnding, 'worn_out' | 'broken_off'>; text: string };
/** SC1/SC2/SC7: the scenario's hidden question, its scale and its endings */
export type ScenarioFrame = {
  question: string; scale: ScenarioScale; endings: PlanEnding[];
  tier: Tier; startTurn: number; startMinute: number; number: number;
  /** who was up and what the player held at the start, for the record */
  upAtStart: string[]; heldAtStart: string[];
  /** places a 'leave' ending names that the player has been in this scenario (leaving needs being there first) */
  beenIn?: string[];
  /** SC2/SC12: turns the player spent fighting, which the budget leaves out */
  fightTurns?: number;
  /** SC8: Weaver check-ins asked so far, and the turn of the last one */
  checkins?: number; lastCheckin?: number;
  /** SC12: the check-in has been told the scenario is over its budget */
  overTime?: true;
  /** CH1: the scenario's ground: the zone the player stood in when it began, every zone its plans built (opening plan,
   * frontier extensions, check-in frontiers once built) and the stage zones they name. Off it with no one chasing: left. */
  ground?: string[];
};
/** SC8/SC15: why a Weaver check-in is asked */
export type CheckinReason = 'beat' | 'budget' | 'judged' | 'stuck';
/** SC8: the check-in's answer: carry on (with new beats) or end the scenario */
/** SC8/SC12: a check-in's answer. continue may also change the scenario (question, scale, endings), send people in through
 * ways that already exist (arrivals: new bands, cast and seeds, as in a stage plan, starting out of the player's sight),
 * and add frontiers on stage zones (new ways out, built later like any frontier). It never builds zones. */
export type CheckinAnswer = {
  verdict: 'continue' | 'end'; as?: string; text?: string; beats?: Trigger[]; note?: string;
  change?: { question?: string; scale?: string; endings?: { when: EndCheck; as: string; text: string }[] };
  arrivals?: { bands: import('./agents').StagePlan['bands']; cast: import('./agents').StagePlan['cast']; seeds?: import('./agents').StagePlan['seeds'] };
  frontiers?: { zone: string; key: string; label: string }[];
};
/** SC6: how one scenario went */
export type ScenarioRecord = {
  number: number; question: string; scale: ScenarioScale; tier: Tier;
  ending: ScenarioEnding; text: string; startTurn: number; endTurn: number;
  fallen: string[]; gained: string[]; inner?: true;
  /** BA8: the barriers the scenario's plans put on ways, to check the tier's lean in the GM view */
  ways?: { barriers: number; locked: number; barred: number; blocked: number; guarded: number; grades: Partial<Record<import('./core').Grade, number>> };
};

export type MemoryEntry = { turn: number; text: string };
export type Agreement = { id: string; parties: [string, string]; text: string; madeTurn: number; madeBy: string };

export type Plan = { goal: string; steps: string[]; triggers: Trigger[]; createdTurn: number };

export type TriggerWhen =
  | { type: 'player_seen_in_zone'; zone: string }
  | { type: 'turn_reached'; turn: number }
  | { type: 'actor_down'; actorId: string }
  | { type: 'alarm_heard' }
  | { type: 'quiet_turns'; turns: number }; // a beat (P7): holds once the scenario has been quiet this many turns in a row

export type Trigger = {
  id: string;
  ownerId: string;
  when: TriggerWhen;
  then: OrderTemplate;
  once: boolean;
  endsScenario?: true; // P7 S2: when it fires, the scenario ends (scenarioBreak story_beat)
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
