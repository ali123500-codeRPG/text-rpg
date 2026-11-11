// The six views (Part 2, Game state model). Every builder copies whitelisted fields into a new object.
// No view holds a gear number, a pool, HP, a roll or a margin.
import type { ActorId, BeliefStatus, Cue, Perception, Stance, Tactics, Tier, TierName, Grade, Fact } from './core';
import type { Plan, Secret } from './hidden';
import type { Volume } from './agents';
import type { DefenseKind } from './actor';

export type HealthLevel = 'Unhurt' | 'Bruised' | 'Hurt' | 'Injured' | 'Wounded' | 'Mauled' | 'Critical' | 'Incapacitated' | 'Dead';
export type PartState = 'Healthy' | 'Damaged' | 'Crippled' | 'Destroyed';

export type OwnGearView = { id: string; itemId: string; name: string; kind: string; equippedIn: string[]; modes: { id: string; name: string }[]; classLabel?: string; weightLabel?: string; qty?: number };
export type SeenGearView = { id: string; name: string; look: string; where: 'held' | 'shield' | 'armor' | 'accessory' };
export type ZoneView = { id: string; name: string; look: string; cover: string; light: string; links: { to: string; label: string; sight: boolean; frontier?: boolean; drop?: boolean }[]; groundItems: { id: string; name: string }[] };
export type MapZone = { id: string; links: { to: string; sight: boolean; frontier?: boolean }[] }; // geometry only, for code minds' pathing

export type BeliefView = {
  about: ActorId;
  status: BeliefStatus;
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  revealed: string[];
  stance: Stance; // RS5: self's stance toward this actor; yielded (Q1/Q4): self broke or surrendered before it, and still flees from it
  hostile: boolean; // hostile(self, about): attacks on sight
  sparring?: true; // SP1: self and this actor are on different sides of a live spar
  active: boolean;
  label: string; // public label or known name
  title?: string; // T18: the title the player wears, only once self has seen them (not heard of or told about them)
};

export type EventView = {
  id: string; turn: number; kind: string; zone: string;
  actorId?: string; // only when perceived fully
  target?: string;
  tier?: TierName; // own view only for full perception
  level: Perception; cue: Cue;
  where?: string; // partial: zone-link label
  line?: { text: string; volume: Volume };
  outcome?: string; // attacks: packet outcome label
  spar?: true; // SP11: a sparring blow (seen fully)
  took?: string; // OQ-29 (NT10): the speaker's own speech roll at the player, as it saw the player take it
  tell?: string; // LI5a Overheard: a lie told to someone else that the viewer saw through
};

/** SP1/SP4: the spar a viewer fights in: opponents and allies (ids in NPC views, names in the player's), the health level
 * that puts a fighter out, whether it is fought until someone is Incapacitated, and whether the viewer is already out */
export type SparView = { opponents: string[]; allies: string[]; limit: HealthLevel; cruel: boolean; out: boolean };

/** PY2: one thing a seller offers: id goes in the buy's item; price in coin words, for the viewer; stock for goods */
export type WareView = { id: string; name: string; price: string; stock?: number };

/** SL9: what a Trader would pay for one of the player's items: id is the player's item, for a sell's item */
export type OfferView = { id: string; name: string; price: string };

/** MB40–MB43: the player's yield this scene, by name: who took it (truce), who has yet to answer, who fought on */
export type YieldView = { took: string[]; waiting: string[]; refused: string[] };

export type SeenActor = {
  id: ActorId; label: string; name?: string; pronouns?: 'he' | 'she' | 'they' | 'it'; zone: string;
  level: Perception; activityLook?: string;
  /** BG-18: where it stands by the way the viewer faces (engine/position.ts sideFrom) */
  side?: 'ahead' | 'left' | 'right' | 'behind';
  distanceM?: number; // ZP5: metres from the viewer, once both stand at points on the map (to 0.1 m)
  health?: HealthLevel; // others: only from Wounded down
  morale?: string; // MB16: others' morale level, only from Afraid down
  stance?: string; // LI2b Read Their Face: a speaker's stance toward the viewer
  crippled?: string[]; destroyed?: string[];
  damaged?: string[]; // A13 Read Wounds: a foe's Damaged parts
  gear: SeenGearView[];
  wares?: WareView[]; // a seller the player sees, at the player's prices
  offers?: OfferView[]; // SL9: what that Trader would pay for each item the player could sell it now
};

// ---------- PlayerView: Agent Parser ----------
export type PlayerView = {
  turn: number;
  player: {
    id: 'player'; name: string; classes: { id: string; name: string }[];
    skills: { id: string; name: string }[]; // skill ID (SK…) and its name; no skill values
    perks: { id: string; name: string }[]; // perk ID (PK…) and its name
    perkMoves?: { id: string; name: string; does: string; action?: true }[]; // AE8: owned perk moves (the Parser's perkMove.perk is the id); does: what it looks like; action: it is the turn's main action
    health: HealthLevel; parts: { id: string; state: PartState }[];
    morale: string; // the morale bar's level (MB11)
    inventory: OwnGearView[];
    posture: 'open' | 'stealthy';
    standingDefense: DefenseKind;
    heldBy?: string; // A8 Hold: who holds the player (as the player calls them); trying to leave is a break-free try
    spar?: SparView; // SP1: the spar the player fights in
    yielded?: YieldView; // MB40: the player yielded in a real fight this scene
  };
  zone: ZoneView;
  zones: ZoneView[]; // zones the player perceives (own + sight links)
  /** the places the player last left, newest first (journal trail): "go back" means cameFrom[0] */
  cameFrom?: { zone: string; name: string; leftTurn: number }[];
  /** BG-15: zones the player knows and ways out of them it has seen: a move can name any of them (the walk finds the way) */
  known?: { id: string; name: string }[];
  actors: SeenActor[];
  /** people seen clearly earlier who are out of sight now, and the zone they were last seen in */
  lastSeen?: { id: string; name: string; zone: string }[];
  facts: string[];
  headlines: string[];
  agreements?: AgreementView[]; // PM5: the player's deals with NPCs
};

/** PM3: one deal as a party sees it; with = what the viewer calls the other party; quest: the job it holds (locked, QT22) */
export type AgreementView = { id: string; with: string; withId: string; text: string; madeTurn: number; quest?: string };
/** QT5/QT8: a job the viewer gave the player, or one that sends the player to it (giver: who gave it, when not the
 * viewer). A finished job shows as active until the player hands it in: the giver only knows what it sees. */
export type JobView = { id: string; text: string; state: string; giver?: string; owed?: string; due?: string; after?: string };

// ---------- ActorView: code minds ----------
/** T4/T5: the day number and time of day; never minutes */
export type TimeView = { day: number; timeOfDay: string };

export type ActorView = {
  turn: number;
  time: TimeView;
  self: {
    id: ActorId; label: string; name: string; kind: 'npc';
    zone: string; placeId: string; bandId: string;
    health: HealthLevel; parts: { id: string; state: PartState }[];
    morale: string; // the morale bar's level
    active: boolean; broken: boolean; surrendered: boolean;
    control: 'agent' | 'code';
    standingDefense: DefenseKind;
    heldBy?: ActorId; // A8 Hold: who holds this actor; trying to leave is a break-free try
    gear: OwnGearView[];
    attackSkill: string; // fallback.attackSkill (template, else body type)
    routine?: { id: string; anchorTurn: number };
    routines: { id: string; brief: string }[];
    routineSetId?: string;
    slots: Record<string, string | string[]>;
    alarm?: { armed: boolean; lastAlarmTurn?: number; returnTo?: { id: string; anchorTurn: number } };
    lastHitBy?: ActorId; // from events it perceived
    stealthy?: true; // NS: moving unseen
    spar?: SparView; // SP1: the spar it is a fighter in
    playerYielded?: true; // MB41: the player yielded to self and awaits an answer (acceptYield)
    wares?: WareView[]; // PY2: what it sells, at the prices the player pays
    offers?: OfferView[]; // SL9: what it would pay for the player's items
  };
  beliefs: BeliefView[];
  perceived: EventView[]; // events it perceived, latest last (no barks), incl. last few exchanges heard
  told: EventView[]; // communication events it perceived
  said: string[]; // its own last spoken lines, latest last (P5)
  earlier?: string[]; // PM6: code-made lines about perceived events older than `perceived`, oldest first
  plan?: Plan;
  memory?: { n: number; turn: number; text: string }[]; // PM1: its memory list, numbered for memory.drop
  agreements?: AgreementView[]; // PM3: the deals it is in
  secrets: Secret[]; // its own
  firedTriggers: { triggerId: string; turn: number }[]; // "already happened"
  band: { id: string; name: string; goals: string; temperament: string; tactics: Tactics; relations: Record<string, Stance> };
  personality: string; // PL1, PL9: Nerve tier with the mood, trait words, values and named types (CHARACTER only; never the Voice)
  map: MapZone[]; // stage geometry
  zones: ZoneView[]; // zones it perceives
  seen: SeenActor[]; // actors it currently perceives
  jobs?: JobView[]; // QT5: the player's jobs from it or sending the player to it
};

// ---------- OppositionView: Agent Planner and Responder ----------
export type OppositionView = ActorView; // formatted for the prompt by the agent wrapper

// ---------- DialogueView: Agent Voice ----------
export type DialogueInput = { spoken: string; impression: string | null }[]; // one entry per speech action this turn
export type DialogueView = Omit<ActorView, 'plan' | 'memory' | 'agreements' | 'secrets' | 'firedTriggers'> & {
  knows: Fact[];
  dialogue: DialogueInput;
};

// ---------- NarrationView: Agent Narrator ----------
export type CombatPacket = {
  event: string;
  actor: string; // 'player' or public label/name
  target: string;
  action: string; // 'melee attack' | 'aimed melee attack' | 'ranged attack' ...
  weapon: string | null; armor: string | null; shield: string | null;
  attack: { tier: TierName; natural: 'lucky' | 'fumble' | null; deciding: string[] };
  defense: { type: DefenseKind; tier: TierName; natural: 'lucky' | 'fumble' | null; deciding: string[] } | null;
  outcome: string; // missed, dodged, grazed, blocked, parried, full hit, heavy hit, crushing hit
  location: { part: string; how: string } | null;
  changes: string[];
  events: string[];
};

export type NarrationEvent = {
  id: string; kind: string;
  level: Perception; cue: Cue;
  actor?: string; // name or label (full only)
  target?: string;
  where?: string; // zone name (full) or link label (partial)
  line?: { text: string; volume: Volume; speaker?: string };
  activityLook?: string; // presence events
  packet?: CombatPacket; // attacks
  spar?: true; // SP11: a sparring blow, not a real attack
  pressed?: { how: string; took?: string }; // OQ-29: an NPC's speech roll at the player, in words
  overheard?: string; // LI5a Overheard: a lie told to someone else that the player saw through, in words
  item?: string; // public item name
  price?: string; // buy: coin paid, in coin words
  metres?: number; // ZP5 moves seen fully: metres walked on this leg (narrated in words: a few paces, across the room)
  spot?: string; // BG-12: where in the zone a move went, in words
  fall?: { metres: number; landing: string }; // SD7: a jump down: the drop and how the landing went (its wounds are in changes)
  from?: string; // BG-22: a move that left a zone: the zone it left (where is the zone it entered)
  within?: true; // BG-22: a move that stayed inside `where` (across it, toward someone, a spot or its way out)
  heading?: string; // BG-22: a leg within `where` on the way to another zone: that zone's name
  for?: string; // buy: who got it
  reason?: string; // buy_refused: why the sale didn't happen
  changes?: string[]; // visible condition changes
  pronouns?: 'he' | 'she' | 'they' | 'it'; targetPronouns?: 'he' | 'she' | 'they' | 'it'; // BG-33: the actor's and target's pronouns, for people no longer in sight at the turn's end
};

export type NarrationView = {
  style: { tone: string; length: string };
  time: TimeView;
  approach?: string; stance?: string; // the player's flavor
  events: NarrationEvent[];
  player: { name: string; health: HealthLevel; morale: string; parts: { id: string; state: PartState }[]; zone: string; stealthy?: true; gear?: string[]; title?: string; personality?: string; yielded?: YieldView }; // personality: the player's sheet words, narration flavour only // ST3: moving or hiding unseen; gear: everything the character has
  surroundings: ZoneView[]; // own zone + sight links (frontiers by label)
  heard: { speaker: string; text: string; volume: Volume }[];
  actors: { label: string; name?: string; pronouns?: 'he' | 'she' | 'they' | 'it'; zone: string; health?: HealthLevel; morale?: string; activityLook?: string }[]; // health: Wounded or worse, morale: Afraid or worse, as the player sees it
  facts: string[];
  headlines: string[];
  notices?: string[]; // out-of-character notices (none sent to the Narrator by default)
};

// ---------- WeaverView: Agent Weaver ----------
export type WeaverView = {
  tier: TierName;
  /** null at story start: the Weaver picks the opening time of day (T8) */
  time: TimeView | null;
  stakes: string;
  /** wake (D-54): the player was knocked out and survived; the plan's first zone is where they wake, somewhere safe */
  target: { kind: 'scene' | 'frontier' | 'checkin'; placeId: string; label?: string; frontierKey?: string; wake?: true;
    /** SC8: why this check-in was asked, and the running scene it is about */
    reason?: import('./hidden').CheckinReason;
    scene?: { question: string; scale: string; endings: { when: import('./hidden').EndCheck; as: string; text: string }[]; turns: number; budget: string; used: number; overTime: boolean };
    /** TV4/TV8: something meets the travelling player on this road zone; noticed: the player saw it coming */
    encounter?: { zone: string; danger: string; noticed: boolean } };
  headlines: string[];
  stage: ZoneView[];
  actors: { id: string; label: string; name: string; zone: string; band: string; templateId?: string; plan?: Plan; secrets: Secret[] }[];
  quests: { id: string; state: string; text: string }[];
  flags: Record<string, string | number | boolean>;
  bands: { id: string; name: string; goals: string; relations: Record<string, Stance> }[];
  player: { level: number; currentClass: { id: string; name: string } | null; health: HealthLevel };
  previousNote: string;
  /** SC6: how the last few scenes went, oldest first (question, scale, tier, ending, who fell, what the player gained) */
  lastScenes: { question: string; scale: string; tier: TierName; ending: string; note: string; turns: number; fallen: string[]; gained: string[]; inner?: true }[];
  /** SC4: the bigger scene (Episode or Venture) this new scene sits inside; it carries on when this one ends */
  outerScene?: { question: string; scale: string };
  catalogs: {
    templates: { id: string; label: string; raceId: string; classId?: string }[];
    services: { id: string; name: string; price: number }[]; // PY3: base prices, before the markup
    bodyTypes: { id: string; name: string }[]; // BT… id and name, plus story body types
    races: { id: string; name: string }[]; // RC… id and name: what a template's raceId names
    classes: { id: string; name: string }[]; // CL… id and name: what a template's classId names
    routineSets: { id: string; brief: string; tags: unknown; slots: Record<string, { kind: string; hint: string }> }[];
    items: { id: string; name: string; kind: string; boon: number }[]; // boon: worth as a reward (loot V8)
    skills: { id: string; name: string }[];
    personality: { nerve: string[]; types: { id: string; name: string; hint: string }[]; values: { id: string; name: string }[] }; // PL12
    zoneKinds: import('./library').ZoneKind[]; // Z2
    edgeKinds: import('./library').EdgeKind[]; // CO15
    layouts: { id: string; name: string; building: string; entry: string; zones: { key: string; name: string }[] }[]; // CO17
  };
  grades: Grade[];
};
