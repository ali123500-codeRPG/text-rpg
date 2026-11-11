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

import type { AWARENESS, COVER, LIGHT, NoiseKey, STANCES, TACTICS, TIERS, VisibilityKey } from '../scales';
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
export type BeliefStatus = (typeof AWARENESS.keys)[number];

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
/** a zone's four sides, by map compass */
export type Side = 'n' | 'e' | 's' | 'w';
export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];
/** a zone's rectangle in metres: centre x east, y north of the story's first zone; w east-west, d north-south */
export type Rect = { x: number; y: number; w: number; d: number };

export type Zone = {
  id: string;
  placeId: PlaceId;
  name: string;
  look: string; // public text
  links: ZoneLink[];
  cover: Cover;
  light: Light; // the zone's own light (lamps, hearths); outdoors the sky can brighten it (src/time.ts zoneLight)
  outdoor?: true; // T3a: under the sky
  /** metres above the ground outside (0 when unset); stairs change it, never distance across the map (src/scene/heights.ts) */
  height?: number;
  /** CO16 floor area in m² (from the size word, the kind's default size, or the Weaver's own figure) */
  area?: number;
  /** CO15 each side's edge kind id (EK); a side not listed is the kind's default */
  edges?: Partial<Record<Side, string>>;
  /** CO16 long side ÷ short side, from the kind (corridors and streets are long) */
  aspect?: number;
  /** set by code (src/scene/geometry.ts placeZones), never by Claude */
  rect?: Rect;
  groundItems: import('./items').ItemInstance[];
};

export type Belief = {
  status: BeliefStatus;
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  /** YD6: the last turn either side attacked or closed in on the other, which keeps hunting and engaged alive */
  closedTurn?: number;
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
  pos?: { x: number; y: number }; // where in the zone it happened: the actor's point (step 2); absent = the zone's centre
  target?: string;
  tier?: Tier;
  effects: Effect[]; // structured; text is built per view, never stored
  noise: NoiseKey;
  visibility: VisibilityKey;
  perception: Record<string, { level: Perception; cue: Cue; heard?: true }>; // absent = not perceived; heard = the sound reached them (words need it)
  spar?: true; // SP1/SP11: an attack between sides of a live spar; anyone who sees it sees a spar
  bark?: boolean; // speech flavor only: narrated, copies no belief, never in NPC views
  // structured payload (code only; views decide what to copy):
  line?: { text: string; volume: 'whisper' | 'normal' | 'shout'; introduces?: string[] };
  fromZone?: string; // moves
  metres?: number; // moves (ZP2): metres walked on this leg; a leg inside one zone has no fromZone, and `target` when closing in
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
  /** OQ-29: an NPC's speech roll at the player: the speech type, whether it landed, the penalty it left, a lie the player saw
   * through, and whether the speaker saw how it was taken */
  push?: { type: string; listener: string; landed: boolean; status?: 'shaken' | 'swayed'; tell?: true; seen?: true };
  /** LI5a Overheard: owners of Overheard who heard this lie told to someone else and saw through it */
  overheard?: string[];
};

export type LogEntry = { turn: number; code: string; detail?: Record<string, unknown> };
