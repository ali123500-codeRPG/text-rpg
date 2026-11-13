// Part 2, Game state model, plus Part 4 §9 ids. Shared by every workstream: change only through the integration owner.
import { GRADE_LEVELS, WEAVER_GRADE_TOP, type GradeLevel } from '../scales';

export type StoryId = string;
export type ActorId = string;
export type PlaceId = string;
export type FactId = string;
export type LibraryRef = string; // id in the story's blueprints or the library (story first)
export type SlotKey = string; // '<subject>.<attribute>'
export type Turn = number;
/** a Weaver grade: GRADE_LEVELS (src/scales.ts) from none up to WEAVER_GRADE_TOP; the task grades past it are GradeLevel only */
export type Grade = Extract<GradeLevel, 'none' | 'minor' | 'moderate' | 'major' | 'extreme'>;
export const GRADES = GRADE_LEVELS.keys.slice(0, GRADE_LEVELS.pos(WEAVER_GRADE_TOP) + 1) as readonly Grade[];

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
 * nothing; attacked again it turns hostile; at the scenario's end it turns opposed (a grudge) and leaves. Not on the
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
  /** CH5: how far its code-run members chase the player (none: the template's, else CONFIG.CHASE_RANGE_DEFAULT) */
  chase?: import('../scales').ChaseRange;
};

/** a way out of a zone. drop (SD7): a window or ledge down to a lower zone: only jumped down, with fall damage from the
 * drop; never walked or climbed. barrier: SD3–SD5 a barrier on this way, by its id in GameState.barriers (one record for
 * both sides of the way) */
export type ZoneLink = { to: string; label: string; sight: boolean; frontier?: true; drop?: true; barrier?: string };
/** SD3–SD5, BA2–BA7: a door, gate, grate or blocked passage on a way. One record serves both sides; the links on each side
 * name it by id. Breaking one (wear, material, thickness) belongs to the walls thread; this record leaves room for it. */
export type WayDid = 'unlocked' | 'unbarred' | 'found_locked' | 'found_barred' | 'found_blocked' | 'lock' | 'unlock' | 'bar' | 'unbar' | 'open' | 'shut'
  | 'picked' | 'picking' | 'not_yet' | 'beyond' | 'pick_broke' | 'found_open' | 'found_opens';
export type Barrier = {
  id: string;
  kind: string; // a barrier kind id (BK, library barrierKinds)
  grade: Grade; // how hard it is: a lock's picking penalty (BA2), how stout it is to break
  lock?: { locked: boolean }; // BA3: opened or locked by a key naming this barrier (ItemInstance.opens), or picked (BA2)
  bar?: { side: string; drawn: boolean }; // BA4: the zone the bolt is on; only that side draws or slides it, in a move slot
  blocked?: true; // BA5: rubble or a cave-in; only clearing it (breaking, the walls thread) opens it
  guarded?: true; // BA6: watched by people; a tag only, for the tier counts (BA8)
  state?: import('../scales').PartStateKey; // walls thread: wear; Destroyed is open to all, Crippled to an amorphous body (BA7)
  material?: string; thicknessCm?: number; // walls thread
  scenario?: number; // the scenario that made it (BA8 counts)
  tried?: string[]; // actors who found it shut by trying it: they know it is locked or barred
  /** BG-70: standing open: sight (and sound) pass it though its link is not a sight link; anyone can shut it again */
  open?: true;
  /** BA2: a picker's Failure leaves the lock beyond them until their Thievery (with tools) is higher than this */
  beyond?: Record<string, number>;
  /** BA2: seconds of picking done toward opening it in a fight, by picker */
  work?: Record<string, number>;
};
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
  /** metres above the ground outside (0 when unset); stairs change it, never distance across the map (src/scenario/heights.ts) */
  height?: number;
  /** CO16 floor area in m² (from the size word, the kind's default size, or the Weaver's own figure) */
  area?: number;
  /** CO15 each side's edge kind id (EK); a side not listed is the kind's default */
  edges?: Partial<Record<Side, string>>;
  /** CO16 long side ÷ short side, from the kind (corridors and streets are long) */
  aspect?: number;
  /** HB3 how loud it is anyway, when not its kind's (a tavern's busy common room) */
  /** the zone kind id (ZK) it was built from (Z2); hand-built test zones may have none */
  kind?: string;
  /** TV4 a road's danger (ROAD_DANGERS); only roads have one */
  danger?: import('../scales').RoadDangerKey;
  /** set by code (src/scenario/geometry.ts placeZones), never by Claude */
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
  /** CH7: the turn a chase after this actor was lost; the chaser goes back to its routine until it sees or hears them again */
  lostTurn?: number;
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
  line?: { text: string; volume: import('./agents').Volume; to?: string }; // to (BG-132): who a reply's words are for
  fromZone?: string; // moves
  beside?: true; // BG-81: a walk at someone (target) that reached them
  fromPos?: { x: number; y: number }; // BG-23: where the leg set off (in fromZone when it left a zone)
  heading?: string; // BG-22: a leg that stays in its zone on the way to another: the zone it heads for
  toGo?: number; // BG-47/BG-48: a leg toward another zone (heading, or a target there): the metres still left to the way out
  metres?: number; // moves (ZP2): metres walked on this leg; a leg inside one zone has no fromZone, and `target` when closing in
  spot?: string; // BG-12: a move to a spot in a zone, in words ("to the north side", "away from the cellar steps")
  /** SD3–SD5, BA2–BA4: something done at a barrier on the way to `to`: opened on the way through (unlocked, unbarred), found
   * shut by trying it (locked, barred, blocked), turned or slid on purpose (lock, unlock, bar, unbar), or picked (BA2) */
  way?: { to: string; barrier?: string; did: WayDid }; // barrier: none on a way with nothing to lock (BG-65)
  fall?: { metres: number; damage: number; landing: string }; // SD7: a jump down a drop link: the drop, the flat damage, the landing roll's tier name
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
  /** NM3: listeners whose answer beat this line's lie (the player's deceive at its spokespeople) */
  seenThrough?: string[];
};

export type LogEntry = { turn: number; code: string; detail?: Record<string, unknown> };
