// Agent I/O (Part 2: Parser, Planner, Responder, Voice, Narrator, Weaver) and the Claude-call boundary.
import type { Cover, Grade, Light, Stance, Tactics } from './core';
import type { GearOp } from './items';
import type { DefenseKind } from './actor';
import type { TimeOfDay } from '../scales';
import type { Plan, Secret, Trigger } from './hidden';

export type AgentName = 'parser' | 'planner' | 'responder' | 'voice' | 'narrator' | 'weaver' | 'autopilot';

export type Volume = 'whisper' | 'normal' | 'shout';
export type ParserActionType =
  | 'attack' | 'hide' | 'sneak' | 'vanish' | 'talk' | 'persuade' | 'deceive' | 'barter' | 'intimidate'
  | 'use_item' | 'equip' | 'give' | 'buy' | 'sell' | 'observe' | 'interact' | 'other' | 'rest' | 'wait' | 'sleep' | 'pick'; // pick: BA2, a lock on the way to target
export const SPEECH_ACTIONS = ['talk', 'persuade', 'deceive', 'barter', 'intimidate'] as const;

// ---- Agent Parser ----
/** the Parser's words for an improvised weapon's base; IMPROVISED_ITEM (engine/gear.ts) maps each to its library item */
export const IMPROVISED_BASES = ['improvised_light', 'improvised_medium', 'improvised_heavy'] as const;
export type ImprovisedBase = (typeof IMPROVISED_BASES)[number];

/** BG-12: a spot inside the move's zone (the player's own zone included), one of: beside someone in view (`near` an actor
 * id) or at a way out (`near` a link's zone id); the far side `awayFrom` someone or a way out; or the `side` a compass word
 * names ("north", "south-west") */
/** lastSeen (BG-125, code-set): near someone the player cannot see now, at the point they last perceived them */
export type MoveSpot = { near?: string; awayFrom?: string; side?: string; lastSeen?: true };
export type Intent = {
  move: { toZone: string; after?: boolean; pace?: import('../scales').TravelPaceKey; spot?: MoveSpot | null; jump?: boolean; behind?: boolean } | null; // behind: BG-62, the player goes behind a counter, fence or rail; after: the action first, then the move (AE3); pace: TV2 on a road trip; spot: BG-12, where in the zone
  action: {
    type: ParserActionType;
    skill: string;
    target: string | null;
    targetPart: string | null;
    item: string | null;
    qty?: number | null; // give: how many of a stack (null: all of it); buy: how many (null: one)
    for?: string | null; // buy: who gets it (null: the buyer)
    mode: string | null;
    approach: string;
    stance: 'careful' | 'normal' | 'reckless';
    /** a scenario object not in the view, used as a weapon: code mints it on an improvised base (loot L3) */
    improvised?: { base: ImprovisedBase; name: string } | null;
  } | null;
  /** AE5/AE8: an owned perk move by perk id (a free one resolves beside the main action) */
  perkMove?: { perk: string; target: string | null } | null;
  /** BA3/BA4: lock or unlock the way to toZone with a key, or slide its bar across or back; it takes the move slot */
  way?: { toZone: string; op: import('../engine/barriers').WayOp } | null;
  gear: GearOp[] | null;
  spoken: string | null;
  /** BG-71: how loud the player says it (whisper, normal, shout); normal when left out */
  volume?: Volume;
  addressees: string[] | null; // actor ids, band ids or "everyone"
  deferred: string[];
  clarify: string | null;
  yields?: boolean; // SP5: the player gives up the spar they are in ("I yield")
};

// ---- Agent Planner / Responder / Voice ----
export type NpcActionType =
  | 'attack' | 'move' | 'search' | 'hide' | 'sneak' | 'vanish' | 'hold' | 'call_help' | 'flee'
  | 'talk' | 'persuade' | 'deceive' | 'intimidate' | 'barter' | 'use_item' | 'equip' | 'give' | 'pick' | 'other';
export type NpcAction = {
  type: NpcActionType;
  target: string | null;
  skill: string | null;
  targetPart: string | null;
  aimed: boolean;
  defense: DefenseKind | null;
  item: string | null;
  qty?: number | null; // give: how many of a stack (null: all of it)
  mode: string | null;
  intent: string;
};
export type PlanUpdate = { goal: string; steps: string[]; triggers: Trigger[]; memoryNote?: string; routine: string | null }; // memoryNote: older outputs, read as one memory entry
/** PM1/PM2: memory list changes; drop names entries by their number in the view (n) */
export type MemoryOps = { add: string[]; drop: number[] };
/** QT2/QT23/QT24/QT25: a job the player agreed to do for the speaker, as the speaker's agent writes it */
export type JobOffer = {
  line: string; // QT4: one short line of what was asked
  goal: { kind: 'defeat' | 'deliver' | 'reach' | 'find' | 'other'; target?: string | null; count?: number | null; item?: string | null; qty?: number | null; to?: string | null };
  pay?: { coin?: number | null; item?: string | null; qty?: number | null } | null; // only a definite promise
  due?: { days: number; by?: TimeOfDay | null } | null;
  after?: string | null; // the quest it follows
};
/** PM3/PM4: a deal struck this turn, said aloud to the other party; job: the deal is a quest for the player (QT1) */
export type AgreementMade = { with: string; text: string; job?: JobOffer | null };
/** QT22/QT6/QT12: a giver calls a job off (said to the player), judges an "other" job done, or hears the player give it up */
export type QuestEnd = { id: string; outcome: 'done' | 'abandoned' | 'called_off' };
export type AgreementEnd = { id: string; outcome: 'done' | 'broken' };
export type StanceStep = { toward: string; step: 'friendlier' | 'colder' };
/** SP2/SP3: a spar agreed aloud this turn: each side's actor ids (the maker on one of them); cruel: fought until someone is
 * Incapacitated, only when every fighter accepted that (SP4) */
export type SparMade = { sides: string[][]; cruel?: boolean };

/** the NPC's one move beside its action, as the player's: toZone is where it heads (it walks toward it; with hold it runs
 * on, a dash); after: act first, then move */
export type NpcMove = { toZone: string; after?: boolean };
export type PlannerOutput = {
  action: NpcAction;
  move?: NpcMove | null;
  dialogue: { line: string; volume: Volume } | null;
  gear: GearOp[] | null;
  stance: StanceStep | null;
  planUpdate: PlanUpdate | null;
  memory?: MemoryOps | null;
  agreement?: AgreementMade | null;
  endAgreements?: AgreementEnd[];
  questEnd?: QuestEnd | null;
  spar?: SparMade | null;
  yields?: boolean; // SP5: gives up the spar it is in
  acceptYield?: boolean; // MB41: takes (true) or refuses the player's yield (self.playerYielded)
  headTo?: string | null; // NW2: where it is going, further than one move: a zone or frontier id; code walks it there
  lead?: string | null; // BF4: who it takes along on that walk; it waits there for them
};
export type ResponderOutput = PlannerOutput & { reveals: string[] };
export type VoiceOutput = {
  action: NpcAction;
  line: string;
  volume: Volume;
  shares: string[];
  gear: GearOp[] | null;
  stance: StanceStep | null;
  routine: string | null;
  agreement?: AgreementMade | null; // PM3: a deal with the player struck in talk
  questEnd?: QuestEnd | null;
  spar?: SparMade | null;
  yields?: boolean;
  acceptYield?: boolean;
  headTo?: string | null; // NW2
  lead?: string | null; // BF4
};

// ---- Agent Narrator ----
/** closing (SD1): one sentence closing the scenario that ended this turn, given only when NarrationView.scenarioEnded is set */
export type NarratorOutput = { text: string; narrated: string[]; closing?: string };

// ---- Agent Weaver: the stage plan ----
/** SD3–SD5: a barrier the Weaver puts on a way: a kind from catalogs.barrierKinds; how hard (grade, default minor); locked
 * (a lock, locked); barredFrom (the zone key the bolt is on, barred); guarded (a tag: guards placed on it); keys (cast keys or
 * actor ids who carry its key). Breaking it is the walls thread's. */
export type PlanBarrier = { kind: string; grade?: Grade; locked?: boolean; barredFrom?: string; guarded?: boolean; keys?: string[] };
export type StagePlan = {
  event: { summary: string; challenge: Grade; gain: Grade };
  /** T8: when the story opens; after that, only the current time of day */
  timeOfDay?: TimeOfDay;
  places: {
    key: string; name: string; kind: string; parent: string;
    /** CO17 a prebuilt layout id: code adds its zones as `${key}.${zoneKey}`; names/looks rename them by the layout's zone keys */
    layout?: string; names?: Record<string, string>; looks?: Record<string, string>;
  }[];
  zones: {
    key: string; place: string; kind: string; name: string; look: string;
    cover?: Cover; light?: Light; // Z3: default from the kind
    height?: number; // metres above the ground; inferred from up/down exit words when left out
    size?: string; // CO16 a ZONE_SIZES word; the kind's default when left out
    area?: number; // CO16 m², instead of a size word
    edges?: Partial<Record<import('./core').Side, string>>; // CO15 edge kind ids by side; the kind's default when left out
    length?: string | number; // TV3 a road's length: a ROAD_LENGTHS word, or km
    danger?: string; // TV4 a road's danger: a ROAD_DANGERS word
    fromLayout?: true; // added by code from a place's layout (not counted against the zone cap)
    links: { to: string; label: string; sight: boolean; drop?: boolean; barrier?: PlanBarrier }[];
  }[];
  frontiers: { key: string; label: string }[];
  bands: {
    key: string; name: string; goals: string; temperament: string;
    tactics: Tactics; lethal: boolean; relations: Record<string, Stance>;
    chase?: import('../scales').ChaseRange; // CH5
  }[];
  cast: {
    template?: string; actor?: string;
    label: string; name: string; appearance: string; pronouns?: 'he' | 'she' | 'they' | 'it';
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
    /** PY2: what a Trader-class seller sells: goods stocked into its inventory, and service ids */
    wares?: { items: { item: string; qty?: number }[]; services: string[] };
    /** PL12: a new actor's Nerve line, up to two named types (PY…) and values (VL…), set on top of its template's points */
    personality?: { nerve?: string; types?: string[]; values?: string[] };
    /** AG14: a new actor's life stage (a LIFE_STAGES name); code picks the years inside it */
    age?: string;
  }[];
  seeds: { plans: (Plan & { ownerId: string })[]; triggers: Trigger[]; secrets: Secret[] };
  rewards: {
    item: string | { base: string; quality: import('../scales').QualityKey; boosts: string; name: string; look: string };
    qty?: number;
    place: { carriedBy: string } | { groundIn: string };
  }[];
  hiddenTerms: string[];
  /** SP2: spars under way or agreed when the scenario opens (a training yard, a tournament): each side's cast keys or actor ids */
  spars?: SparMade[];
  weaverNote: string;
  /** SC1/SC2/SC7: a new scenario's hidden question, its scale, and two or three ways it can end (not on a frontier extension) */
  scenario?: { question: string; scale: string; endings: { when: import('./hidden').EndCheck; as: string; text: string }[] };
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
