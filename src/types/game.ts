// The boundary between the game (W7 pipeline) and the screens (W8).
import type { GameState } from './state';
import type { Pronouns } from './actor';
import type { AgentTurnLog, Volume } from './agents';
import type { Tier } from './core';
import type { LogEntry } from './core';
import type { HealthLevelKey, PartStateKey } from '../scales';

export type CreationBuild = { name: string; skills: Record<string, number>; tagged: string[]; classId?: string /* the starting class; left out = swordsman */; pronouns?: Pronouns /* the character's gender as others speak of them; left out = they */; personality?: import('./actor').Personality /* PL14: left out = no lean */; age?: number /* AG15: whole years; left out = the start's default */ };

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
  /** achievements and scars earned this turn (progression.achievements id, its name now), with what the play screen shows:
   * reward level (REWARD_LEVELS key and name), XP, what it asks for (earnedAt), why it was earned, and its rewards (engine achievementInfo) */
  achievements?: AchievementNote[];
  incomingChecks?: (LineCheck & { by: string })[]; // rolls others made against the player this turn; by = how the player knows them
  downedBy?: DownedBy; // the turn left the player down: the last blow that hurt them, as they knew it ("You fell" screen)
  wounds?: { id: string; from: PartStateKey; to: PartStateKey }[]; // M-30: the player's body parts whose state got worse this turn
  gear?: string[]; // what the turn changed in the player's gear, ready to show: "Picked up: …", "Now held: right hand · …", "Gone: …"
  nerveBroke?: true; // MB12: the player's morale reached Broken this turn (the play screen's Nerve broken card)
  nerveRefused?: true; // MB12: the player's attack this turn was refused because their nerve is broken
  coin?: number; // what the turn changed in the player's coin, in copper: 12 gained, -5 lost (left out of `gear`)
  /** AT11a: long actions the player saw this turn, theirs first: who (You, or the name the screen uses), the action, whole seconds
   * done and to go after the turn, and whether it goes on, was finished, was broken off by a blow, or was set aside */
  actions?: ActionNote[];
  ways?: string[]; // what the player did at doors, gates and other barriers this turn, ready to show: "Door to the cellar: locked"
  place?: { id: string; name: string; zone?: string }; // where the player ended the turn; name like "River path · the Riverside", zone like "cellar"
  scenario?: number; // stage.scenarioNumber when the turn ended
  /** SD1: this turn ended a scenario: how (SCENARIO_ENDINGS key and its name), and the Narrator's closing line for it, which the
   * play page shows before the scenario break; text is then the rest of the turn and the next scenario's opening */
  scenarioEnd?: ScenarioEndNote;
  /** D-226: the gains of the scenario this turn ended; while set, that line carries no achievements, unlocks or levelUps of its own */
  scenarioGains?: ScenarioGains;
};
export type ActionNote = { who: string; what: string; done: number; left: number; state: 'going' | 'done' | 'broken' | 'stopped' };
export type ScenarioEndNote = { as: import('./hidden').ScenarioEnding; name: string; closing?: string };
/** D-226: what the player gained in a scenario, for the ending moment's gains pop-up (on the narration line of the turn that
 * ended it, LogLine.scenarioGains). Achievements and All-XXX are granted at the end; skill raises, XP and levels are what the
 * scenario brought in all. An empty list = nothing of that kind. */
/** one row of the gains moment's XP sum: kind says what earned it, label names it for the player */
export type XpPart = { kind: 'defeat' | 'achievement' | 'quest' | 'other'; label: string; amount: number };
/** one scenario's gains kept on the character (Progression.gainsLog): its number, how it ended, the turn it ended on, and the
 * closing line the Narrator gave it (added once the turn's narration arrives) */
export type GainsRecord = ScenarioGains & { number: number; ending: import('./hidden').ScenarioEnding; endTurn: number; closing?: string };
export type ScenarioGains = {
  skills: { skill: string; from: number; to: number }[]; // raw skill before and after
  perks: { skill: string; milestone: number }[]; // milestone perks unlocked (never named)
  allPerks: { tree: string; step: number; name: string }[]; // All-XXX earned: tree id, step (50, 100…), its name
  achievements: AchievementNote[]; // granted at the end, scars included
  xp: { gained: number; fromLevel: number; fromPct: number; toLevel: number; toPct: number; // pct = the sheet's XP bar fill
    /** where gained came from, in the order first earned: foes defeated together in one row, each achievement and quest its own */
    parts?: XpPart[] };
  levelUps: { classId: string; level: number }[];
  /** growth proposal 2.5: essences offered at this ending moment (name and grade; take or pass with /essence) */
  essences?: { name: string; grade: string }[];
};

/** a hall-of-fame row: the fallen character, whose story it was, and its story id */
export type FallenCharacter = import('./state').FameEntry & { owner: import('./state').StoryOwner; storyId: string;
  /** HF34 a: sent with "Send to NPC template" (waiting for Claude's PR), or already a unique in the library */
  sent?: true; inLibrary?: true };

/** the blow that dropped the player, in words the player knows: by = the attacker as perceived ('someone' if unseen) */
export type DownedBy = { by: string; weapon: string | null; part: string | null; outcome: string; unseen?: true };

/** one healing of the player: the health level and each body part that changed state */
/** better: health went up without changing level or any part state (a bandage on a light wound) */
export type AchievementNote = { id: string; name: string; level?: string; levelName?: string; xp?: number; scar?: boolean; earnedAt?: string; why?: string; rewards?: string[] };
export type HealNote = { source: string; from: HealthLevelKey; to: HealthLevelKey; parts: { id: string; from: PartStateKey; to: PartStateKey }[]; better?: boolean };

export type LineCheck = {
  kind: 'attack' | 'contest' | 'roll';
  skill: string; // skill id
  tier: Tier; beyond?: number;
  against?: { what: string; tier: Tier; beyond?: number }; // the defense or the other side of a contest, e.g. "its dodge"
  shifts?: string[]; // BG-200: what moved the gap besides the two tiers, e.g. "cover: 1 tier his way"
  result: string; // "full hit, body", "you win the exchange"
  /** the player's own attack: whom, with what, and what the player saw it change (the strike card on Play) */
  strike?: { target: string; weapon: string | null; changes: string[] };
};

export type Notice =
  | { kind: 'scenario_fallback'; text: string } // "Scenario planning failed: placeholder area"
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
  /** SD1: while a turn that ended a scenario is still running (the next scenario's Weaver and Narrator calls), how it ended, so the
   * play page can start the ending moment then; null otherwise */
  scenarioEnding(): ScenarioEndNote | null;
  fell(): boolean; // "You fell" screen (lethal fight incapacitated the player)
  subscribe(cb: () => void): () => void;
  validateBuild(build: CreationBuild): string[]; // empty = valid
  /** worldId: carry on that free world (HF31) instead of starting a new one */
  newStory(build: CreationBuild, opts?: { owner?: import('./state').StoryOwner; worldId?: string }): Promise<void>;
  /** load the owner's latest story (the player's by default); false when it has none */
  resume(owner?: import('./state').StoryOwner): Promise<boolean>;
  /** autopilot: the agent's next command and one short line of commentary, or null when the call failed */
  hallOfFame(): Promise<FallenCharacter[]>; // archived stories whose character fell, newest first
  /** HF34 a: "Send to NPC template": the fallen character's echo sheet goes on the library send list; the page then wakes Claude */
  sendHero(storyId: string): Promise<{ id: string } | { error: string }>;
  /** HF34 a, the GM view: something the Weaver made in this story (a blueprint, by id) goes on the library send list for review */
  sendBlueprint(id: string): Promise<{ id: string } | { error: string }>;
  /** the library send list, newest first */
  librarySends(): Promise<import('../save/sends').LibrarySend[]>;
  /** HF31: the player's free worlds (no one lives in them), newest fall first */
  worlds(): Promise<import('../save').FreeWorld[]>;
  /** WP5: title a world (an empty name goes back to the default) */
  titleWorld(worldId: string, name: string): Promise<void>;
  /** files the player's own bug report (code player_report) with the story, turn and last lines; resolves to its BG id */
  reportBug(note: string): Promise<string | null>;
  /** the open bugs, newest first */
  openBugs(): Promise<import('../save/bugs').FiledBug[]>;
  /** style: a VOICE_STYLES id; ja: the commentary in Japanese, for the 'japanese' style */
  /** guided: the guided mode's context (GA1–GA17); the move may then be a question for the watcher (ask, no command) */
  agentMove(persona?: string, style?: string, guided?: import('../agents/crossroads').GuidedCtx): Promise<import('../agents/autopilot').Move | null>;
  /** free text or a /command; aimed comes from the Aim toggle */
  submit(text: string, opts: { aimed: boolean }): Promise<void>;
  reset(): Promise<void>; // confirmed by the UI first
  /** SC15: the GM view's End scenario button: the running scenario ends after the next turn */
  endScenario(): void;
  gm(): GmSnapshot;
  /** GM view: the last CONFIG.GM_AGENT_CALLS_SHOWN agent calls made for one actor, newest first, from this turn and the kept turn records */
  agentHistory(actorId: string): Promise<AgentTurnLog[]>;
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
