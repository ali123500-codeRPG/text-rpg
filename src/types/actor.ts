// Part 4 §4 and §9: the actor sheet.
import type { ActorId, Belief, Fact, FactId, LibraryRef, PlaceId, SlotKey, StoryId, Turn, Stance } from './core';
import type { ItemInstance } from './items';

export type NameHistory = { current: string; past: { name: string; untilTurn: Turn }[] };

export type Actor = {
  id: ActorId;
  storyId: StoryId;
  kind: 'player' | 'npc';
  names: NameHistory;
  label: string; // public stranger label
  appearance?: string; // public text from the stage plan (W6)
  knownOnSight?: boolean;
  placeId: PlaceId; // always the place of `zone`
  zone: string;
  posture?: 'open' | 'sneaking'; // player only
  bandId: string;
  core: Core;
  progression?: Progression;
  mind?: Mind;
  journal?: Journal;
};

export type SkillState = 'tagged' | 'normal' | 'flawed';
export type SkillEntry = { raw: number; state: SkillState; dormant?: boolean };

export type Core = {
  raceId?: LibraryRef;
  creatureTypeId: LibraryRef;
  templateId?: LibraryRef;
  generation?: 'unique' | 'copy';
  skills: Record<LibraryRef, SkillEntry>;
  classes: ClassEntry[];
  perks: OwnedPerk[];
  condition: SavedCondition;
  inventory: ItemInstance[];
  standingDefense: 'dodge' | 'block';
};

export type ClassEntry = {
  classId: LibraryRef;
  state: 'unlocked' | 'current' | 'previous';
  level: number;
  dormant?: boolean;
};

export type OwnedPerk = {
  perkId: LibraryRef;
  source: 'level' | 'mastery';
  gainedTurn: Turn;
  treeId?: LibraryRef;
  tier?: 50 | 100 | 150;
  dormant?: boolean;
};

export type SavedCondition = {
  hpLostPct: number; // health-track level is derived from this
  parts: Record<string, number>; // body-part id -> pool % left (100 = full), state derived
  destroyed?: string[]; // reserved
  status: string[];
};

export type Progression = {
  startingTotal: number;
  potential: { base: number; adjustments: { source: string; delta: number; turn: Turn }[] };
  xp: number;
  unspentPerkPoints: number;
  marks: LibraryRef[];
  xpLog?: XpAward[]; // source trail (B8); every award, in order
  achievements?: { id: string; name: string; turn: Turn }[]; // earned, each once (B4, X6)
  defeats?: Record<string, number>; // defeat counts: 'all', 'creature:<type>', 'race:<race>'
  nextClass?: LibraryRef; // X9: the class the next level goes to (current or unlocked); absent = current
};

export type XpAward = { source: string; amount: number; turn: Turn; levelUp?: { classId: LibraryRef; level: number } };

export type Mind = {
  control: 'agent' | 'code';
  behavior: string;
  morale?: number;
  fearless?: boolean; // from the template's personality
  moraleState?: 'broken' | 'surrendered';
  hitByPlayer?: true; // X5: the player has hit it
  xpPaid?: true; // its defeat has paid XP (B4)
  knowledge: Record<ActorId, Belief>;
  overrides?: Record<ActorId, Stance>;
  knows: Fact[];
  routine?: { id: string; anchorTurn: Turn };
  routines?: string[];
  routineSetId?: LibraryRef;
  slots?: Record<string, string | string[]>;
  alarm?: { armed: boolean; lastAlarmTurn?: Turn; returnTo?: { id: string; anchorTurn: Turn }; onAlertDue?: string /* routine id whose onAlert is still to fire (W5) */ };
};

export type NpcTemplate = {
  id: LibraryRef;
  creatureTypeId: LibraryRef;
  raceId?: LibraryRef;
  classId?: LibraryRef;
  generation: 'unique' | 'copy';
  minimums: Record<LibraryRef, number>;
  level: number;
  bonusPoints: number;
  focus: { treeId: LibraryRef; skill: LibraryRef }[];
  personality: 'fearless' | 'bold' | 'steady' | 'timid';
  loadout?: LibraryRef[];
  potential?: number;
  control: 'agent' | 'code';
  label: string;
  fallback?: { attackSkill: LibraryRef }; // overrides the creature type's (Fallback behavior)
};

export type Journal = {
  secretsKnown: string[];
  factsWitnessed: FactId[];
  remembered: Record<SlotKey, { value: string; seenTurn: Turn }>;
  namesKnown: ActorId[];
  /** Q17 (Ali, 07/11/2026): actors the player has seen clearly, and the zone they were in; they stay seen until they move */
  clearSight?: Record<ActorId, string>;
};

export type { PlaceId };
