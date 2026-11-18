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
  lethal: boolean;
  relations: Record<string, Stance>;
  /** CH5: how far its code-run members chase the player (none: the template's, else CONFIG.CHASE_RANGE_DEFAULT) */
  chase?: import('../scales').ChaseRange;
};

/** SD3–SD5, BA2–BA7: a door, gate, grate, shutters or blocked passage on a way. One record serves both sides; its opening
 * names it by id (Opening.barrier). Breaking one (wear, material, thickness) belongs to the walls thread; this record leaves room for it. */
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
  /** BG-70: standing open: sight (and sound) pass its opening though it is not seen through shut; anyone can shut it again */
  open?: true;
  /** BA2: a picker's Failure leaves the lock beyond them until their Lockpicking (with tools) is higher than this */
  beyond?: Record<string, number>;
  /** OD12: actors who tried to pick it: they know its grade */
  graded?: string[];
  /** BA2: seconds of picking done toward opening it in a fight, by picker */
  work?: Record<string, number>;
  /** BW13 a: seconds of breaking done on it, by breaker (their shares add); wornTurn: the turn of the latest (BW9 b regrowth) */
  wear?: Record<string, number>;
  wornTurn?: number;
};
/** a zone's four sides, by map compass */
export type Side = 'n' | 'e' | 's' | 'w';
export const SIDES: readonly Side[] = ['n', 'e', 's', 'w'];
/** the side across from each side */
export const OPP_SIDE: Readonly<Record<Side, Side>> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** one step toward each side on a grid whose y runs north (a region's gx, gy) */
export const SIDE_STEP: Readonly<Record<Side, readonly [number, number]>> = { n: [0, 1], e: [1, 0], s: [0, -1], w: [-1, 0] };
/** each side's compass word */
export const SIDE_WORD: Readonly<Record<Side, string>> = { n: 'north', e: 'east', s: 'south', w: 'west' };
/** a zone's rectangle in metres: centre x east, y north of the story's first zone; w east-west, d north-south */
export type Rect = { x: number; y: number; w: number; d: number };

/** a point in metres in the world's frame: x east, y north */
export type Pt = { x: number; y: number };
/** WZ1 land first: one region of land, about REGION_SIZE_M across, that code drew once from a seed and the Weaver's brief
 * (src/land). Stored as drawn, so nothing on it ever moves. Its grid runs row by row from the south-west corner. */
export type Region = {
  id: string;
  /** a region kind id (RK) */
  kind: string;
  name: string;
  look: string; // the brief's words for the region (Weaver, hidden side until seen)
  /** its square on the world's grid of REGION_SIZE_M squares: x east, y north; the first region is 0,0 */
  gx: number; gy: number;
  seed: number;
  /** metres across, and metres per grid cell */
  size: number; cell: number;
  /** each cell's ground height in whole metres above the sea */
  heights: number[];
  /** each cell's land cover: one character per cell, the base-36 number of its land cover id (LC1 is "1") */
  cover: string;
  waters: Water[];
  roads: RoadLine[];
  /** where roads meet: a site, a junction, or the region's edge (a way on to the next region) */
  nodes: RoadNode[];
  sites: Site[];
  features: LandFeature[];
  /** WZ13 the site the story opened in (the first region only) */
  start?: string;
  /** the regions beyond each edge, by the brief's names, until they are drawn */
  beyond: Partial<Record<Side, { name: string; kind?: string }>>;
};
/** a river or stream: its line downstream, in metres */
export type Water = { id: string; kind: 'river' | 'stream'; name: string; width: number; pts: Pt[] };
/** zone (WI2 a): a junction's zone once built, kept like RoadLine.zone; a junction found on a road later (a road encounter
 * opening a side way) is a new node of the same kind, added to the region's nodes; feature (RE8): a side way's far end
 * at a landmark (LandFeature id), named after it */
export type RoadNode = { id: string; kind: 'site' | 'junction' | 'edge'; at: Pt; site?: string; side?: Side; zone?: string; feature?: string };
/** WZ8 a stretch of road or path between two nodes; roads branch at junctions */
export type RoadLine = {
  id: string; kind: 'road' | 'path'; name?: string; danger: import('../scales').RoadDangerKey;
  ends: [string, string]; pts: Pt[]; length: number;
  crossings: { at: Pt; kind: 'bridge' | 'ford'; water: string }[];
  /** the road zone built for it, once someone needs it */
  zone?: string;
};
/** a settlement site: the brief names it; a place the Weaver builds there names the site (Place.site) */
export type Site = { id: string; size: 'town' | 'village' | 'hamlet'; name: string; look: string; at: Pt; why: string; placeId?: string };
/** a landmark the brief asked for (a quarry, a ruin, a mill), where code found it room */
export type LandFeature = { id: string; kind: string; name: string; look: string; at: Pt };

/** FR1, PZ1: a named piece of furniture standing at a point (pos, on its floor) in the title it was drawn in (zone): a
 * counter, a bed, a cart. side: the compass side or corner ('n', 'ne', ...) it was drawn by, or the middle when left out.
 * Mostly colour: a move can end beside it, and search and stash work where one stands. FR4: one on an edge (a counter, a
 * rail) shows from both sides. grade (OD2): set when someone can do something hard with it, or by the first act on it
 * (OD3); graded: who has tried it, and sees its grade (OD12). */
export type Furniture = { id: string; kind: string; name: string; placeId: PlaceId; zone: string; pos: Pt; floor: number; side?: string; edge?: true;
  grade?: Grade; graded?: string[]; beyond?: Record<string, number> };
/** PZ7: a point with the floor it is on (metres above the ground outside) */
export type Pt3 = Pt & { floor: number };
/** PZ1 a: a title: the name of a space. Its space is a footprint of any shape (outline, a polygon in metres, corners
 * counter-clockwise) between a bottom and a top height (floor, top: metres above the ground outside), so each floor of a
 * building can be named on its own. A point's title is the smallest space that holds it (src/plan/where.ts zoneAt).
 * Walls, openings, light, clutter and furniture are on the floor plan (src/plan), never on the title. */
export type Zone = {
  id: string;
  placeId: PlaceId;
  name: string;
  look: string; // public text
  /** the title kind id (ZK) it was drawn from (PZ14); hand-built test titles may have none */
  kind?: string;
  outline: Pt[];
  floor: number;
  top: number;
  /** CO16 floor area in m² it was drawn at (from the size word, the kind's default size, or the Weaver's own figure) */
  area?: number;
  /** PZ9: the region road line (RoadLine id) a road's title runs along */
  road?: string;
  /** PZ9: a road's centre line, its title drawn ROAD_WIDTH_M wide along it (a land road's points, or a straight line of
   * its length where no land lies under it); travel walks it */
  line?: Pt[];
  /** TV4: the danger of a road with no land line under it (a land road's is on its RoadLine) */
  danger?: import('../scales').RoadDangerKey;
};
/** PZ2: a wall on the floor plan: a segment from a to b standing from floor to top, of a wall kind (library wallKinds, WK) */
export type Wall = { id: string; placeId: PlaceId; a: Pt; b: Pt; floor: number; top: number; kind: string; material?: string; thicknessM: number; dents?: WallDent[] };
/** BW11 a, BW13 a: a spot on a wall someone is breaking through: the seconds of work by breaker (their shares add), the turn
 * of the latest (BW9 b regrowth), and the hole cut there once it is Crippled (an opening, crack) */
export type WallDent = { at: Pt; wear: Record<string, number>; turn: number; hole?: string };
/** PZ2: a way: a doorway, gap, window, stairs, ladder or hatch (library openingKinds, OK) at a spot (at, on floor) along a
 * wall (wall) or in a floor. joins: the titles either side (a frontier's second is its frontier key); labels: how the way
 * reads from joins[0] and from joins[1]. to: stairs, ladders, hatches and drops reach a point on another floor. barrier: its
 * door, gate, grate, shutters or rubble (GameState.barriers). seeThrough: with no barrier standing open, whether it shows
 * the far side (a gap, an arch or a window does; a plain doorway does not). drop (SD7): a window or ledge over lower ground,
 * only ever jumped down. */
export type Opening = {
  id: string; placeId: PlaceId; kind: string;
  at: Pt; floor: number; wall?: string;
  widthM: number; heightM: number; sillM?: number;
  to?: Pt3;
  joins: [string, string]; labels: [string, string];
  barrier?: string; seeThrough: boolean;
  frontier?: true; drop?: true;
  /** BW11 a: a hole broken halfway through a wall (Crippled): seen and heard through, but only an amorphous body passes */
  crack?: true;
};
/** PZ10 a: how the Weaver, a layout or a test names a way between two titles: open (a gap or arch, seen through), door (a
 * doorway, not seen through while shut), window (seen through, only jumped down: a drop, SD7), up or down (stairs, a
 * ladder or a hatch to the floor above or below) */
export type WayKind = 'open' | 'door' | 'window' | 'up' | 'down';
/** PZ14 a: a way as drawing takes it: to a title (or a frontier key), its label from this side and back, its kind; sight
 * overrides the kind's seen-through; barrier: an existing barrier record's id */
export type WaySpec = { to: string; label: string; back?: string; kind?: WayKind; sight?: boolean; frontier?: true; barrier?: string };
/** PZ14 a: a title as drawing takes it (src/plan/draw.ts drawTitles): the title, plus how to draw it. A spec given an
 * outline (or rect) is not placed again. */
export type TitleSpec = Omit<Zone, 'outline' | 'floor' | 'top'> & {
  outline?: Pt[]; rect?: Rect; floor?: number; top?: number;
  /** a roof over it (indoors); default: its kind's, else none */
  roof?: boolean;
  /** each side's wall kind (WK) where it differs from the kind's default */
  walls?: Partial<Record<Side, string>>;
  /** the light word it is drawn lit to (PZ5: a source at its middle); default: its kind's */
  light?: Light;
  /** CO16 long side ÷ short side */
  aspect?: number;
  ways: WaySpec[];
  furniture?: import('./library').PlanFurniture[];
  /** PZ9: a road's centre line (a land road's points, or a straight line of its length) */
  line?: Pt[];
};
/** PZ5: a roof over an outline at height h (the floor of the storey above, or the roof itself): under it is indoors */
export type Roof = { id: string; placeId: PlaceId; outline: Pt[]; h: number };
/** PZ5 a (D-391): a light source: a kind (library lightKinds, LK), a point and height above the ground outside, a brightness
 * in candela; lit unless lit is false */
export type LightSource = { id: string; placeId: PlaceId; kind: string; at: Pt; h: number; candela: number; lit?: false };

export type Belief = {
  status: BeliefStatus;
  /** PZ11 a: the title of lastKnownAt, for words */
  lastKnownZone?: string;
  /** PZ11 a: where it was last made out: a point and floor */
  lastKnownAt?: Pt3;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  /** YD6: the last turn either side attacked or closed in on the other, which keeps hunting and engaged alive */
  closedTurn?: number;
  /** CH7: the turn a chase after this actor was lost; the chaser goes back to its routine until it sees or hears them again */
  lostTurn?: number;
  /** AT73/AT80: game minutes its last fade step fell due (perception applyBeliefDecay) */
  fadedAt?: number;
  revealed: string[]; // e.g. 'has_crossbow', 'item:<instanceId>' for revealed concealed items
  /** BF97 a: what this actor made out the last time it sized the other up with Insight and won (speech.ts sizeUp) */
  read?: PersonRead;
};

/** BF97 a: a won Insight look at a person: their mood, how they feel about the one looking, and whether they hide something (never what) */
export type PersonRead = { turn: number; mood: string; feels: Stance; hiding: boolean };

export type Fact = { id: string; text: string };

export type Effect = { kind: string; actorId: string; data: Record<string, unknown> };

export type GameEvent = {
  id: string;
  turn: number;
  actorId: string;
  kind: string; // 'attack','move','idle','speak','call_help','alarm','arrival','presence','item_dropped','give','wasted','search','hold','threshold_crossed','part_state_changed', ...
  zone: string;
  pos?: { x: number; y: number }; // where it happened: the actor's point on its title's floor; absent = the title's middle
  target?: string;
  tier?: Tier;
  effects: Effect[]; // structured; text is built per view, never stored
  noise: NoiseKey;
  visibility: VisibilityKey;
  perception: Record<string, { level: Perception; cue: Cue; heard?: true }>; // absent = not perceived; heard = the sound reached them (words need it)
  spar?: true; // SP1/SP11: an attack between sides of a live spar; anyone who sees it sees a spar
  ranged?: true; // BG-251: a shot or throw: its target feels it only when it meets them (blocked or past); an impact sounds where it lands
  impact?: 'hard' | 'soft'; // BG-251: an impact event: what the missile struck (armour, a shield, a hard surface; or flesh, soft ground)
  bark?: boolean; // speech flavor only: narrated, copies no belief, never in NPC views
  // structured payload (code only; views decide what to copy):
  line?: { text: string; volume: import('./agents').Volume; to?: string }; // to (BG-132): who a reply's words are for
  fromZone?: string; // moves
  beside?: true; // BG-81: a walk at someone (target) that reached them
  fromPos?: { x: number; y: number }; // BG-23: where the leg set off (in fromZone when it left a zone)
  heading?: string; // BG-22: a leg that stays in its zone on the way to another: the zone it heads for
  summed?: true; // BF2e: a catch-up leg of a long turn (a trade, a rest): told in its summary, never as its own move
  round?: { way: string; shut: 'blocked' | 'barred' | 'locked' }; // BG-148: a walk that goes round a way it knows is shut (its label)
  toGo?: number; // BG-47/BG-48: a leg toward another zone (heading, or a target there): the metres still left to the way out
  metres?: number; // moves (ZP2): metres walked on this leg; a leg inside one zone has no fromZone, and `target` when closing in; wasted out_of_reach: metres still short (BG-163)
  spot?: string; // BG-12: a move to a spot in a zone, in words ("to the north side", "away from the cellar steps")
  lastSeenOf?: string; // BG-203: the walk is to where the player last saw this actor
  /** SD3–SD5, BA2–BA4: something done at a barrier on the way to `to`: opened on the way through (unlocked, unbarred), found
   * shut by trying it (locked, barred, blocked), turned or slid on purpose (lock, unlock, bar, unbar), or picked (BA2) */
  way?: { to: string; barrier?: string; did: WayDid }; // barrier: none on a way with nothing to lock (BG-65)
  fall?: { metres: number; damage: number; landing: string }; // SD7: a jump down a drop link: the drop, the flat damage, the landing roll's tier name
  spotted?: string[]; // VS3 Strike and Fade (a 'vanish' event): the observers the attack from hiding made aware
  activity?: string; // idle / presence: ActivityDef id
  itemId?: string; // item instance involved (gear, give, thrown, dropped)
  into?: string; // put_in: the container instance it went into
  /** AT2/AT17: a long action going on (kind 'busy'): its Action times row and seconds done of `need`; or broken off (kind
   * 'broke_off', `then` what is left of it: lost or kept) */
  busy?: { row: string; done: number; need: number; then?: string };
  qty?: number; // give, buy: how many changed hands
  service?: string; // buy: the service bought
  price?: number; // buy: coin paid
  for?: string; // buy: who got it, when not the buyer
  reason?: string; // buy_refused: why
  steady?: { points: number; buff?: true }; // SY1: morale won back (+) or lost (−) steadying oneself; buff: left Mentally steady
  filch?: 'taken' | 'fumbled' | 'caught'; // FL4: how a filch went (src/engine/filch.ts)
  attack?: import('./ruleset').AttackResult; // attacks only; code only, never copied to a view
  contest?: import('./ruleset').ContestResult;
  /** BF97 a: an Insight look at a person (observe) the looker won: what they made out */
  read?: PersonRead;
  /** OD1 b/OD3: an act on a graded thing (use, interact, other): the skill, the grade, and whether it was sure, out of reach or rolled */
  obstacle?: { skill: string; grade: Grade; gate: 'sure' | 'out' | 'roll' };
  /** OD5: a graded act's Critical Failure: a tool that broke (its instance), a fall (see fall), or a loud noise */
  mishap?: { kind: 'tool' | 'fall' | 'noise'; item?: string };
  /** Q17: the player's look, a sight roll */
  roll?: import('./ruleset').RollResult;
  /** PG3/PG9: the player's make-out roll on this event (something half seen or half heard): its difficulty and whether
   * it made it out; shown only with Show rolls on */
  madeOut?: { roll: import('./ruleset').RollResult; target: number; passed: boolean };
  speech?: { skill: string; impression?: string; addressees: string[] }; // dialogue-turn speech
  /** OQ-29: an NPC's speech roll at the player: the speech type, whether it landed, the penalty it left, a lie the player saw
   * through, and whether the speaker saw how it was taken */
  push?: { type: string; listener: string; landed: boolean; status?: 'shaken' | 'swayed'; tell?: true; doubt?: true; seen?: true; offer?: 'convinced' | 'tempted' | 'unmoved' }; // offer: TF11, an offer to stand down, how it landed
  /** TF13: the player's words were an offer to stop fighting: how they landed with each listener */
  offers?: { to: string; landed: 'convinced' | 'tempted' | 'unmoved'; demand?: 'yield' }[]; // demand: TF19, it asked them to surrender
  /** BF31: a container broken open (kind break_open): whether it opened; cut: a blade cut a soft one open, no roll */
  breakOpen?: { opened: boolean; cut?: true; broke?: string[]; beyond?: true }; // broke: BK2, instance ids of what broke inside; beyond: OD13, out of the breaker's reach (no roll)
  /** BW8-BW26: a turn of breaking through a wall or a barrier on a way (kind break_through): what (wall or barrier), the
   * title it leads to (none: unbuilt ground), the share of the work done (0-1, everyone's), its state once Crippled or
   * Destroyed this turn, and the seconds the breaker still needs at their own rate */
  breakThrough?: { wall?: string; barrier?: string; to?: string; share: number; state?: 'crippled' | 'destroyed'; left?: number; tool?: string; toolBroke?: true; walked?: true }; // walked: BW21 a, gone straight through on a walk
  extract?: { essence: string; grade: string }; // DX3: an essence pulled out of the target (an essence row id and its grade)
  /** TF19: a surrender talked out of a foe (kind surrender; actorId gave up to target): bandmates that gave up with it */
  surrender?: { with: string[] };
  /** TF16: a stand-down (kind stand_down; actorId stood down from target): bandmates that went with it, coin paid for it */
  standDown?: { with: string[]; coin?: number };
  /** LI5a Overheard: owners of Overheard who heard this lie told to someone else and saw through it */
  overheard?: string[];
  /** NM3: listeners whose answer beat this line's lie (the player's deceive at its spokespeople) */
  seenThrough?: string[];
};

export type LogEntry = { turn: number; code: string; detail?: Record<string, unknown> };
