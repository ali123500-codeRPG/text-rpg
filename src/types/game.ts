// The boundary between the game (W7 pipeline) and the screens (W8).
import type { GameState } from './state';
import type { AgentTurnLog, Volume } from './agents';
import type { Tier } from './core';
import type { LogEntry } from './core';

export type CreationBuild = { name: string; skills: Record<string, number>; tagged: string[] };

export type LogLine = {
  turn: number;
  kind: 'player' | 'narration' | 'clarify' | 'command' | 'notice';
  text: string;
  mechanics?: string[]; // dice, modifiers, damage from code (shown while SHOW_MECHANICS is on)
  // Play screen extras on a narration line, all built by code from what the character perceived (no numbers):
  check?: LineCheck; // the player's own roll this turn
  speech?: { speaker: string; volume: Volume; text: string }[]; // lines the character heard, word for word
  changes?: { kind: 'combat' | 'condition' | 'health'; text: string }[]; // what changed this turn
  next?: string; // Q16: what the player put off this turn (the Parser's deferred), offered in the action box
  // taken from the turn's code log before it is cleared (the log only lives until the next turn starts)
  heals?: HealNote[]; // H11: the player's healing this turn
  unlocks?: { skill: string; milestone: number }[]; // V2a: milestones a skill crossed this turn
  gains?: Record<string, number>; // V1b: skill points gained this turn, by skill
};

/** one healing of the player: the health level and each body part that changed state */
/** better: health went up without changing level or any part state (a bandage on a light wound) */
export type HealNote = { source: string; from: string; to: string; parts: { id: string; from: string; to: string }[]; better?: boolean };

export type LineCheck = {
  kind: 'attack' | 'contest' | 'roll';
  skill: string; // skill id
  tier: Tier; beyond?: number;
  against?: { what: string; tier: Tier; beyond?: number }; // the defense or the other side of a contest, e.g. "its dodge"
  result: string; // "full hit, body", "you win the exchange"
};

export type Notice =
  | { kind: 'scene_fallback'; text: string } // "Scene planning failed: placeholder area"
  | { kind: 'rate_limited'; text: string }
  | { kind: 'stop_play'; text: string } // not_granted, sampling_disabled, session_expired
  | { kind: 'read_only'; text: string } // another window holds the turn lock
  | { kind: 'save_failed'; text: string }
  | { kind: 'load_refused'; text: string };

export type GmSnapshot = {
  state: GameState | null;
  agentLog: AgentTurnLog[]; // last turn's exact agent inputs and outputs
  log: LogEntry[];
  fallbackBanner: boolean; // red banner while any fallback area is on the stage
  backups: { turn: number; path: string }[];
};

export interface GameApi {
  /** current story state (read-only for the UI) */
  state(): GameState | null;
  lines(): LogLine[];
  notices(): Notice[];
  busy(): boolean;
  fell(): boolean; // "You fell" screen (lethal fight incapacitated the player)
  subscribe(cb: () => void): () => void;
  validateBuild(build: CreationBuild): string[]; // empty = valid
  newStory(build: CreationBuild): Promise<void>;
  resume(): Promise<boolean>; // load the latest story; false when none
  /** free text or a /command; aimed comes from the Aim toggle */
  submit(text: string, opts: { aimed: boolean }): Promise<void>;
  reset(): Promise<void>; // confirmed by the UI first
  gm(): GmSnapshot;
  calls(): number; // Claude calls made in this session (page load), counted by code
  /** Claude calls in flight now, oldest first: which agent and since when (Date.now ms) */
  working(): { agent: import('./agents').AgentName; since: number }[];
  restoreBackup(turn: number): Promise<void>;
  /** spend a perk point on a ladder perk, or undo it before the next turn (K3); in memory until the next turn saves */
  takePerk(perkId: string): void;
  undoPerk(perkId: string): void;
}
