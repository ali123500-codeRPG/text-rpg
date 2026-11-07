// Agent I/O (Part 2: Parser, Planner, Responder, Voice, Narrator, Weaver) and the Claude-call boundary.
import type { Cover, Grade, Light, Stance, Tactics } from './core';
import type { GearOp } from './items';
import type { Plan, Secret, Trigger } from './hidden';

export type AgentName = 'parser' | 'planner' | 'responder' | 'voice' | 'narrator' | 'weaver';

export type Volume = 'whisper' | 'normal' | 'shout';
export type ParserActionType =
  | 'attack' | 'hide' | 'sneak' | 'talk' | 'persuade' | 'deceive' | 'barter' | 'intimidate'
  | 'use_item' | 'equip' | 'give' | 'observe' | 'interact' | 'other' | 'rest';
export const SPEECH_ACTIONS = ['talk', 'persuade', 'deceive', 'barter', 'intimidate'] as const;

// ---- Agent Parser ----
export const IMPROVISED_BASES = ['improvised_light', 'improvised_medium', 'improvised_heavy'] as const;
export type ImprovisedBase = (typeof IMPROVISED_BASES)[number];

export type Intent = {
  move: { toZone: string } | null;
  action: {
    type: ParserActionType;
    skill: string;
    target: string | null;
    targetPart: string | null;
    item: string | null;
    mode: string | null;
    approach: string;
    stance: 'careful' | 'normal' | 'reckless';
    /** a scene object not in the view, used as a weapon: code mints it on an improvised base (loot L3) */
    improvised?: { base: ImprovisedBase; name: string } | null;
  } | null;
  gear: GearOp[] | null;
  spoken: string | null;
  addressees: string[] | null; // actor ids, band ids or "everyone"
  deferred: string[];
  clarify: string | null;
};

// ---- Agent Planner / Responder / Voice ----
export type NpcActionType =
  | 'attack' | 'move' | 'search' | 'hide' | 'hold' | 'call_help' | 'flee'
  | 'talk' | 'use_item' | 'equip' | 'give' | 'other';
export type NpcAction = {
  type: NpcActionType;
  target: string | null;
  skill: string | null;
  targetPart: string | null;
  aimed: boolean;
  defense: 'dodge' | 'block' | null;
  item: string | null;
  mode: string | null;
  intent: string;
};
export type PlanUpdate = { goal: string; steps: string[]; triggers: Trigger[]; memoryNote: string; routine: string | null };
export type StanceStep = { toward: string; step: 'friendlier' | 'more_opposed' };

export type PlannerOutput = {
  action: NpcAction;
  dialogue: { line: string; volume: Volume; introduces?: string[] } | null;
  gear: GearOp[] | null;
  stance: StanceStep | null;
  planUpdate: PlanUpdate | null;
};
export type ResponderOutput = PlannerOutput & { reveals: string[] };
export type VoiceOutput = {
  action: NpcAction;
  line: string;
  volume: Volume;
  shares: string[];
  introduces?: string[];
  gear: GearOp[] | null;
  stance: StanceStep | null;
  routine: string | null;
};

// ---- Agent Narrator ----
export type NarratorOutput = { text: string; narrated: string[] };

// ---- Agent Weaver: the stage plan ----
export type StagePlan = {
  event: { summary: string; challenge: Grade; gain: Grade };
  places: { key: string; name: string; kind: string; parent: string }[];
  zones: {
    key: string; place: string; name: string; look: string;
    cover: Cover; light: Light;
    links: { to: string; label: string; sight: boolean }[];
  }[];
  frontiers: { key: string; label: string }[];
  bands: {
    key: string; name: string; goals: string; temperament: string;
    tactics: Tactics; lethal: boolean; relations: Record<string, Stance>;
  }[];
  cast: {
    template?: string; actor?: string;
    label: string; name: string; appearance: string;
    knownOnSight?: boolean; knows?: { id: string; text: string }[];
    key: string; band: string; routineSetId: string;
    slots: Record<string, string | string[]>;
    startAt?: string;
    routineGap?: string;
    /** what this actor knows of the player at the opening (V3) */
    awarenessOfPlayer: 'unaware' | 'suspicious' | 'aware';
    /** what this actor knows of each band's members on the stage (V3) */
    awarenessOfBands?: { band: string; awareness: 'unaware' | 'suspicious' | 'aware' }[];
    overrides?: { actor: string; stance: Stance }[];
    motive: string;
  }[];
  seeds: { plans: (Plan & { ownerId: string })[]; triggers: Trigger[]; secrets: Secret[] };
  rewards: {
    item: string | { base: string; quality: 1 | 2 | 3 | 4; boosts: string; name: string; look: string };
    qty?: number;
    place: { carriedBy: string } | { groundIn: string };
  }[];
  hiddenTerms: string[];
  weaverNote: string;
};

// ---- the Claude-call boundary (artifact `sample` capability, runtime 0.2.96) ----
export type ModelTier = 'quick' | 'default' | 'complex';
export type Effort = 'low' | 'medium' | 'high';
export type ClaudeRequest = {
  agent: AgentName;
  actorId?: string;
  input: { role: 'user'; content: string }[]; // [FIXED_INSTRUCTIONS, PER_TURN_DATA]
  modelTier?: ModelTier;
  model?: string;
  effort?: Effort;
  json: boolean;
  signal?: AbortSignal;
  cache?: false;
};
export type ClaudeErrorCode =
  | 'upstream_error' | 'rate_limited' | 'refused' | 'invalid_json' | 'not_granted'
  | 'sampling_disabled' | 'session_expired' | 'cancelled';
export type ClaudeResponse =
  | { ok: true; value: unknown; truncated?: boolean; modelTierApplied?: string; modelApplied?: string }
  | { ok: false; error: ClaudeErrorCode; message?: string };
export interface ClaudeClient {
  call(req: ClaudeRequest): Promise<ClaudeResponse>;
}

export type AgentCallStatus = 'ok' | 'repaired' | 'fallback' | 'late' | 'cancelled' | 'unused' | 'failed';
export type AgentTurnLog = {
  turn: number;
  agent: AgentName;
  actorId?: string;
  input: unknown; // exact input sent (the view as serialised)
  output: unknown; // exact accepted output (or null)
  rawOutputs?: unknown[]; // every raw answer, including rejected ones
  status: AgentCallStatus;
  errors: string[]; // codes: planner_late, view_leak, invalid_target, invalid_gear, invalid_reveal, call_failed, rate_limited, refused, ...
  modelTierApplied?: string;
  modelApplied?: string;
  startedAt?: number;
  endedAt?: number;
};

/** time source for windows and timeouts; tests use a virtual clock */
export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}
