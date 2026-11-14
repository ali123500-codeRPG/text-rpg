// Part 2, Hidden state persistence; routines from Game state model.
import type { Grade, Tier } from './core';
import type { Order } from './ruleset';
import type { AttentionKey, NoiseKey, ScenarioScale, TimeOfDay, VisibilityKey } from '../scales';
import type { RoutineRun } from './actor';

export type HiddenStore = {
  plans: Record<string, Plan>; // actorId -> plan
  /** UG1/UG2: goal holders (uniques) by actor id: their goals and queued steps; only they think by goals */
  drives?: Record<string, Drive>;
  memory: Record<string, MemoryEntry[]>; // actorId -> memory list (PM1, at most CONFIG.MEMORY_ENTRIES)
  /** PM3/PM4: deals between two actors (the player or NPCs), kept until done or broken */
  agreements?: Agreement[];
  secrets: Secret[];
  firedLog: { triggerId: string; turn: number; ownerId?: string }[];
  weaverNote: string;
  stage: { eventSummary: string; challenge: Grade; gain: Grade; hiddenTerms: string[] };
  /** W6: per-actor hidden Weaver text (motive, routineGap); GM view only. Not an agenda (hasAgenda ignores it). */
  castNotes?: Record<string, { motive: string; routineGap?: string; templateGap?: string }>;
  /** NG15: every templateGap the Weaver wrote, for the GM view's "Templates wanted" list (kept across scenarios) */
  templateWants?: { turn: number; scenario: number; actorId: string; label: string; wanted: string; template: string }[];
  /** NG16 b: each scenario's hostile cast power against the player's, with the challenge grade's band; logged only */
  castPower?: { turn: number; scenario: number; challenge: string; hostile: number; player: number; ratio: number; band?: [number, number]; off: boolean }[];
  /** SC6: how each scenario went, oldest first (CONFIG.SCENARIO_RECORDS_SAVED kept); the next Weaver gets the last few */
  scenarios?: ScenarioRecord[];
};

/** SC10: how a scenario ended. An unordered category, so the names are the IDs (display names: SCENARIO_ENDING_NAMES). */
export const SCENARIO_ENDINGS = ['resolved', 'lost', 'left', 'escaped', 'interrupted', 'worn_out', 'broken_off'] as const;
export type ScenarioEnding = (typeof SCENARIO_ENDINGS)[number];
/** SC10: the endings code alone sets (a scenario overrunning its time, a knock-out); a plan or a check-in names the rest */
export const CODE_ENDINGS = ['worn_out', 'broken_off'] as const;
/** SC10: the endings a plan or a check-in may name */
export const PLAN_ENDINGS = SCENARIO_ENDINGS.filter((e) => !(CODE_ENDINGS as readonly string[]).includes(e)) as Exclude<ScenarioEnding, (typeof CODE_ENDINGS)[number]>[];
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
export type PlanEnding = { when: EndCheck; as: (typeof PLAN_ENDINGS)[number]; text: string };
/** SC1/SC2/SC7: the scenario's hidden question, its scale and its endings */
export type ScenarioFrame = {
  question: string; scale: ScenarioScale; endings: PlanEnding[];
  tier: Tier; startTurn: number; startMinute: number; number: number;
  /** who was up and what the player held at the start, for the record */
  upAtStart: string[]; heldAtStart: string[];
  /** places a 'leave' ending names that the player has been in this scenario (leaving needs being there first) */
  beenIn?: string[];
  /** SC8: Weaver check-ins asked so far, and the turn of the last one */
  checkins?: number; lastCheckin?: number;
  /** SC12: the check-in has been told the scenario is over its budget */
  overTime?: true;
  /** CH1: the scenario's ground: the zone the player stood in when it began, every zone its plans built (opening plan,
   * frontier extensions, check-in frontiers once built) and the stage zones they name. Off it with no one chasing: left. */
  ground?: string[];
  /** BG-41: what happened in it, one short hidden line per notable thing (spars, yields, defeats, gives, trades, jobs, deals) */
  happened?: { turn: number; text: string }[];
  /** D-226: the player's raises and All-XXX so far in it, for the ending moment's summary (engine/growth.ts) */
  gains?: Pick<import('./game').ScenarioGains, 'skills' | 'perks' | 'allPerks'>;
  /** D-226: the player's XP log length, level and XP bar fill when it began (the summary's XP and levels count from there) */
  xpFrom?: number; xpStart?: { level: number; pct: number };
  /** TF20 b, BS1-BS3: everyone the player bested in it (defeated, or talked or bribed out of a fight), whose essence lists
   * make its ending's offers (EB1) */
  bested?: string[];
  /** EG13: steps past Critical Success on its event roll (each pays GROWTH_ROLLS_PAST_CRIT more rolls at its end) */
  beyond?: number;
  /** SC4/EG13: while an inner scenario runs, the player's owed rolls and waiting achievements from this (outer) one, kept
   * apart so the inner scenario pays only for its own; they come back when it resumes, or join the inner's if both end */
  held?: { marks: string[]; pending?: { key: string; of?: string; reached?: number }[] };
};
/** SC8/SC15: why a Weaver check-in is asked */
export type CheckinReason = 'beat' | 'budget' | 'judged' | 'stuck';
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

/** UG2: a standing aim; about: the ids it names (people, places, zones, items): perceiving one wakes a think (UG7 moment 3).
 * standing (UG3 d): written on the template, dropped only when met */
export type Goal = { text: string; about?: string[]; standing?: true; turn: number };
/** UG17: when a routine or wait step ends: a time of day, or someone's arrival where it is */
export type StepEnd = { at?: TimeOfDay; arrival?: string };
/** UG11: one step code runs with no call: go to a zone or frontier (maybe leading someone), run a routine, or wait here */
export type GoalStep = { go?: string; lead?: string; routine?: string; wait?: true; until?: StepEnd };
/** UG5/UG16: a goal holder's goals, its queue (the first step is under way, ending by endsAt at the latest), the routine it
 * goes back to when the queue runs out (back), why it should think next (think), and the named things it perceives now */
export type Drive = { goals: Goal[]; steps: GoalStep[]; endsAt?: number; back?: RoutineRun; think?: string; noticed?: string[] };

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
  slots: Record<string, { kind: 'zone' | 'route'; hint: string; optional?: true }>; // optional (RT): may be left unbound
  routines: string[]; // [default, ...others]
};
export type RoutineStep = { slot: string; duration: DurationId; activity: string };
export type TimedSteps = { at: import('../scales').TimeOfDay[]; steps: RoutineStep[] };
export type Routine = {
  id: string;
  brief: string;
  kind: 'schedule' | 'follow' | 'wait' | 'head'; // head (NW2): walk to slot 'dest', then back to the routine before it
  loop: boolean;
  steps: RoutineStep[]; // schedule only; [] otherwise. NW10: the steps at any time of day `times` does not name
  /** NW10: the steps at some times of day, when they differ from `steps`. NW13: one entry may cover several times
   * (`at: ['evening', 'night']`); no time of day is named twice. */
  times?: TimedSteps[];
  activity?: string; // follow, wait and head only
  alert?: string;
  onAlert: OrderTemplate | null;
  posture?: 'stealthy'; // NS: the actor keeps stealthy while on this routine (the thief's prowl)
};
export type ActivityDef = {
  id: string;
  look: string;
  attention: AttentionKey;
  noise: NoiseKey;
  visibility: VisibilityKey;
};
