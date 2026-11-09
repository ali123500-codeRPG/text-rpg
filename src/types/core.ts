// Part 2, Game state model, plus Part 4 §9 ids. Shared by every workstream: change only through the integration owner.

export type StoryId = string;
export type ActorId = string;
export type PlaceId = string;
export type FactId = string;
export type LibraryRef = string; // id in the story's blueprints or the library (story first)
export type SlotKey = string; // '<subject>.<attribute>'
export type Turn = number;
export type Grade = 'none' | 'minor' | 'moderate' | 'major' | 'extreme'; // [Proposed] scale
export const GRADES: readonly Grade[] = ['none', 'minor', 'moderate', 'major', 'extreme'];

/** a tier's display name, only in text for people and for Claude */
export type TierName = string;

import type { COVER, LIGHT, NoiseKey, STANCES, TACTICS, TIERS, VisibilityKey } from '../scales';
/** keys of the ordered scales in src/scales.ts (code and saves use only keys) */
export type Light = (typeof LIGHT.keys)[number];
export type Cover = (typeof COVER.keys)[number];
export type Tier = (typeof TIERS.keys)[number];
/** a rolled tier: clamped to the table, plus the steps a shifted roll went past the end (+ above, − below) */
export type TierRoll = { tier: Tier; beyond?: number };
export type Tactics = (typeof TACTICS.keys)[number];

export type Mode = 'explore' | 'dialogue' | 'tactical';
export type Perception = 'full' | 'partial';
export type Cue = 'sight' | 'sound' | 'smell' | 'touch';
/** yielded (Q1): a surrendered actor's stance toward those it was fighting. Never attacks, blocks
 * nothing; attacked again it turns hostile; at the scene's end it turns opposed (a grudge) and leaves. Not on the
 * STANCES scale: agents can't choose it, only a surrender sets it. */
export type Stance = (typeof STANCES.keys)[number] | 'yielded';
export type BeliefStatus = 'unaware' | 'suspicious' | 'aware' | 'tracking';
export const BELIEF_ORDER: readonly BeliefStatus[] = ['unaware', 'suspicious', 'aware', 'tracking'];

export type Band = {
  id: string;
  name: string; // public
  goals: string; // hidden text (Weaver)
  temperament: string; // hidden text (Weaver)
  tactics: Tactics;
  lethal: boolean;
  relations: Record<string, Stance>;
};

export type ZoneLink = { to: string; label: string; sight: boolean; frontier?: true };
export type Zone = {
  id: string;
  placeId: PlaceId;
  name: string;
  look: string; // public text
  links: ZoneLink[];
  cover: Cover;
  light: Light; // the zone's own light (lamps, hearths); outdoors the sky can brighten it (src/time.ts zoneLight)
  outdoor?: true; // T3a: under the sky
  groundItems: import('./items').ItemInstance[];
};

export type Belief = {
  status: BeliefStatus;
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  revealed: string[]; // e.g. 'has_crossbow', 'item:<instanceId>' for revealed concealed items
};

export type Fact = { id: string; text: string };

export type Effect = { kind: string; actorId: string; data: Record<string, unknown> };

export type GameEvent = {
  id: string;
  turn: number;
  actorId: string;
  kind: string; // 'attack','move','idle','speak','call_help','alarm','arrival','presence','item_dropped','give','wasted','search','hold','threshold_crossed','part_state_changed', ...
  zone: string;
  target?: string;
  tier?: Tier;
  effects: Effect[]; // structured; text is built per view, never stored
  noise: NoiseKey;
  visibility: VisibilityKey;
  perception: Record<string, { level: Perception; cue: Cue }>; // absent = not perceived
  bark?: boolean; // speech flavor only: narrated, copies no belief, never in NPC views
  // structured payload (code only; views decide what to copy):
  line?: { text: string; volume: 'whisper' | 'normal' | 'shout'; introduces?: string[] };
  fromZone?: string; // moves
  vanish?: true; // ST11–ST19: the player's Vanish move (breaks the sight of those who see them)
  activity?: string; // idle / presence: ActivityDef id
  itemId?: string; // item instance involved (gear, give, thrown, dropped)
  qty?: number; // give, buy: how many changed hands
  service?: string; // buy: the service bought
  price?: number; // buy: coin paid
  for?: string; // buy: who got it, when not the buyer
  reason?: string; // buy_refused: why
  attack?: import('./ruleset').AttackResult; // attacks only; code only, never copied to a view
  contest?: import('./ruleset').ContestResult;
  check?: import('./ruleset').CheckResult;
  /** Q17: the player's look, a sight roll */
  roll?: import('./ruleset').RollResult;
  speech?: { skill: string; impression?: string; addressees: string[] }; // dialogue-turn speech
};

export type LogEntry = { turn: number; code: string; detail?: Record<string, unknown> };
