// The boundary between the game (W7 pipeline) and the screens (W8).
import type { GameState } from './state';
import type { Pronouns } from './actor';
import type { AgentTurnLog, Volume } from './agents';
import type { Tier } from './core';
import type { LogEntry } from './core';

export type CreationBuild = { name: string; skills: Record<string, number>; tagged: string[]; classId?: string /* the starting class; left out = swordsman */; pronouns?: Pronouns /* the character's gender as others speak of them; left out = they */ };

export type LogLine = {
  turn: number;
  kind: 'player' | 'narration' | 'clarify' | 'command' | 'notice';
  text: string;
  aimed?: true; // a player line: the turn was aimed (the Aim toggle or /aim)
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
  timePassed?: { minutes: number; day: number; timeOfDay: string }; // T2 b: a wait or sleep; timeOfDay is a TIME_OF_DAY key
  levelUps?: { classId: string; level: number }[]; // X9: levels the player reached this turn, by class (library classes id)
  achievements?: { id: string; name: string }[]; // achievements and scars earned this turn (progression.achievements id, its name now)
  incomingChecks?: (LineCheck & { by: string })[]; // rolls others made against the player this turn; by = how the player knows them
  downedBy?: DownedBy; // the turn left the player down: the last blow that hurt them, as they knew it ("You fell" screen)
  gear?: string[]; // what the turn changed in the player's gear, ready to show: "Picked up: …", "Now held: right hand · …", "Gone: …"
  place?: { id: string; name: string }; // where the player ended the turn; name like "River path · the Riverside"
  scene?: number; // stage.sceneNumber when the turn ended
};

/** a hall-of-fame row: the fallen character, whose story it was, and its story id */
export type FallenCharacter = import('./state').FameEntry & { owner: import('./state').StoryOwner; storyId: string };

/** the blow that dropped the player, in words the player knows: by = the attacker as perceived ('someone' if unseen) */
export type DownedBy = { by: string; weapon: string | null; part: string | null; outcome: string; unseen?: true };

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
  newStory(build: CreationBuild, opts?: { owner?: import('./state').StoryOwner }): Promise<void>;
  /** load the owner's latest story (the player's by default); false when it has none */
  resume(owner?: import('./state').StoryOwner): Promise<boolean>;
  /** autopilot: the agent's next command and one short line of commentary, or null when the call failed */
  hallOfFame(): Promise<FallenCharacter[]>; // archived stories whose character fell, newest first
  agentMove(persona?: string): Promise<{ command: string; say: string } | null>;
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
  /** QT12: give up an open quest (the giver cools one step); in memory until the next turn saves */
  abandonQuest(questId: string): void;
  /** pin a quest to the Play screen's quest line, or unpin it */
  pinQuest(questId: string): void;
}
