// The boundary between the game (W7 pipeline) and the screens (W8).
import type { GameState } from './state';
import type { AgentTurnLog } from './agents';
import type { LogEntry } from './core';

export type CreationBuild = { name: string; skills: Record<string, number>; tagged: string[] };

export type LogLine = {
  turn: number;
  kind: 'player' | 'narration' | 'clarify' | 'command' | 'notice';
  text: string;
  mechanics?: string[]; // dice, modifiers, damage from code (shown while SHOW_MECHANICS is on)
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
  restoreBackup(turn: number): Promise<void>;
}
