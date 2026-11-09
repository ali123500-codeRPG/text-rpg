// The six views (Part 2, Game state model). Every builder copies whitelisted fields into a new object.
// No view holds a gear number, a pool, HP, a roll or a margin.
import type { ActorId, BeliefStatus, Cue, Perception, Stance, Tactics, Tier, TierName, Grade, Fact } from './core';
import type { Plan, Secret } from './hidden';
import type { Volume } from './agents';

export type HealthLevel = 'Unhurt' | 'Bruised' | 'Hurt' | 'Injured' | 'Wounded' | 'Mauled' | 'Critical' | 'Incapacitated' | 'Dead';
export type PartState = 'Healthy' | 'Damaged' | 'Crippled' | 'Destroyed';

export type OwnGearView = { id: string; itemId: string; name: string; kind: string; equippedIn: string[]; modes: string[]; classLabel?: string; weightLabel?: string; qty?: number };
export type SeenGearView = { id: string; name: string; look: string; where: 'held' | 'shield' | 'armor' | 'accessory' };
export type ZoneView = { id: string; name: string; look: string; cover: string; light: string; links: { to: string; label: string; sight: boolean; frontier?: boolean }[]; groundItems: { id: string; name: string }[] };
export type MapZone = { id: string; links: { to: string; sight: boolean; frontier?: boolean }[] }; // geometry only, for code minds' pathing

export type BeliefView = {
  about: ActorId;
  status: BeliefStatus;
  lastKnownZone?: string;
  lastSeenTurn?: number;
  source: 'seen' | 'heard' | 'told';
  revealed: string[];
  hostile: boolean; // hostile(self, about): attacks on sight
  yielded?: true; // Q1/Q4: self yielded to (broke or surrendered before) this actor; a broken actor still flees from it
  active: boolean;
  label: string; // public label or known name
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
};

/** PY2: one thing a seller offers: id goes in the buy's item; price in coin words, for the viewer; stock for goods */
export type WareView = { id: string; name: string; price: string; stock?: number };

export type SeenActor = {
  id: ActorId; label: string; name?: string; pronouns?: 'he' | 'she' | 'they' | 'it'; zone: string;
  level: Perception; activityLook?: string;
  health?: HealthLevel; // others: only from Wounded down
  crippled?: string[]; destroyed?: string[];
  damaged?: string[]; // A13 Read Wounds: a foe's Damaged parts
  gear: SeenGearView[];
  wares?: WareView[]; // a seller the player sees, at the player's prices
};

// ---------- PlayerView: Agent Parser ----------
export type PlayerView = {
  turn: number;
  player: {
    id: 'player'; name: string; classes: string[];
    skills: { id: string; name: string }[]; // skill ID (a number) and its name; no skill values
    perks: string[];
    perkMoves?: string[]; // AE8: owned perk moves by perk id (the Parser's perkMove.perk)
    health: HealthLevel; parts: { id: string; state: PartState }[];
    inventory: OwnGearView[];
    posture: 'open' | 'stealthy';
    standingDefense: 'dodge' | 'block';
    heldBy?: string; // A8 Hold: who holds the player (as the player calls them); trying to leave is a break-free try
  };
  zone: ZoneView;
  zones: ZoneView[]; // zones the player perceives (own + sight links)
  actors: SeenActor[];
  /** people seen clearly earlier who are out of sight now, and the zone they were last seen in */
  lastSeen?: { id: string; name: string; zone: string }[];
  facts: string[];
  headlines: string[];
  agreements?: AgreementView[]; // PM5: the player's deals with NPCs
};

/** PM3: one deal as a party sees it; with = what the viewer calls the other party */
export type AgreementView = { id: string; with: string; withId: string; text: string; madeTurn: number };

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
    active: boolean; broken: boolean; surrendered: boolean; fearless: boolean;
    control: 'agent' | 'code';
    standingDefense: 'dodge' | 'block';
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
    wares?: WareView[]; // PY2: what it sells, at the prices the player pays
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
  map: MapZone[]; // stage geometry
  zones: ZoneView[]; // zones it perceives
  seen: SeenActor[]; // actors it currently perceives
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
  defense: { type: 'dodge' | 'block'; tier: TierName; natural: 'lucky' | 'fumble' | null; deciding: string[] } | null;
  outcome: string; // missed, dodged, grazed, blocked, full hit, heavy hit, crushing hit
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
  item?: string; // public item name
  price?: string; // buy: coin paid, in coin words
  for?: string; // buy: who got it
  reason?: string; // buy_refused: why the sale didn't happen
  changes?: string[]; // visible condition changes
};

export type NarrationView = {
  style: { tone: string; length: string };
  time: TimeView;
  approach?: string; stance?: string; // the player's flavor
  events: NarrationEvent[];
  player: { name: string; health: HealthLevel; parts: { id: string; state: PartState }[]; zone: string; stealthy?: true; gear?: string[] }; // ST3: moving or hiding unseen; gear: everything the character has
  surroundings: ZoneView[]; // own zone + sight links (frontiers by label)
  heard: { speaker: string; text: string; volume: Volume }[];
  actors: { label: string; name?: string; pronouns?: 'he' | 'she' | 'they' | 'it'; zone: string; health?: HealthLevel; activityLook?: string }[]; // health: Wounded or worse, as the player sees it
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
  target: { kind: 'scene' | 'frontier'; placeId: string; label?: string; frontierKey?: string };
  headlines: string[];
  stage: ZoneView[];
  actors: { id: string; label: string; name: string; zone: string; band: string; templateId?: string; plan?: Plan; secrets: Secret[] }[];
  quests: { id: string; state: string; text: string }[];
  flags: Record<string, string | number | boolean>;
  bands: { id: string; name: string; goals: string; relations: Record<string, Stance> }[];
  player: { level: number; currentClass: string | null; health: HealthLevel };
  previousNote: string;
  catalogs: {
    templates: { id: string; label: string; raceId: string; classId?: string }[];
    services: { id: string; name: string; price: number }[]; // PY3: base prices, before the markup
    bodyTypes: string[];
    routineSets: { id: string; brief: string; tags: unknown; slots: Record<string, { kind: string; hint: string }> }[];
    items: { id: string; name: string; kind: string; boon: number }[]; // boon: worth as a reward (loot V8)
    skills: { id: string; name: string }[];
    zoneKinds: import('./library').ZoneKind[]; // Z2
  };
  grades: Grade[];
};
