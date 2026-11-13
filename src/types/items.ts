// Part 4 §9 (ItemDef, ItemInstance) and Part 5.
import type { SkillFunction } from './library';
import type { LibraryRef } from './core';
import type { ArmorWeightKey, EquipLevelKey } from '../scales';

export type ItemDef = {
  id: LibraryRef;
  /** AT11: a ranged weapon's shot (an Action times row, DU), and the spanning it needs before each shot (a crossbow) */
  shotTime?: string; spanTime?: string;
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'tool' | 'consumable' | 'misc';
  name: string;
  look: string; // public text
  bulk: 0 | 1 | 2 | 3;
  value: number; // hand-set coin value, used only by consumables and items with no benefit numbers; other items are priced from their benefits (src/ruleset/value.ts)
  heal?: string; // a healing source id (H2): using the item applies that row and uses it up
  boon?: number; // hand-set Boon, overrides value ÷ BOON_COIN (loot V8b)
  stackable?: true;
  consumable?: true;
  concealed?: true;
  hiddenAt?: import('./core').Tier; // SE9: worn concealed, a look over its wearer must beat this outcome tier to spot it (SE11)
  visible?: true;
  slot?: 'armor' | 'accessory';
  hands?: 1 | 2;
  effects?: ItemEffect[];
  weapon?: { modes: AttackMode[] };
  armor?: {
    covers: string[];
    reduction: number;
    multiplier: number;
    weight: ArmorWeightKey;
    pools?: Record<string, number>;
    /** RD7 how much it slows its wearer: flat m/s off the base speed, then a share off what is left. Default: CONFIG.ARMOR_SPEED by weight */
    speed?: { flat: number; pct: number };
  };
  shield?: { pool: number };
  level?: EquipLevelKey; // EQ8/EQ10: equipment level: how much its requirement asks for
  gearClass?: string; // GC id: which skill its requirement asks for (library gearClasses)
  base?: { itemId: LibraryRef; quality: import('../scales').QualityKey; boosts: string };
  tags?: string[]; // 'kit' marks a standard-kit piece (one shared bonus per roll)
  /** D-218 Threadbound item: one of a kind in the world. It binds to the first who wears it; while its owner wears it, each
   * grant's perk is theirs once they have earned its achievement (src/ruleset/threadboundItems.ts) */
  threadbound?: { rank: import('../scales').ThreadboundRankKey; grants: { perk: LibraryRef; achievement: string }[] }; // rank: TB11, its Rank (THREADBOUND_RANKS)
  /** CT1: it holds other items. worn: a pack worn on the back (CT7: its wearer's stowed items are its contents); fixed:
   * it stands in a zone and can't be picked up (a chest); neither: carried or set down (a sack) */
  container?: { worn?: true; fixed?: true };
};

export type RollKind = 'hit' | 'dodge' | 'block' | 'parry' | 'perception' | 'stealth' | 'event' | 'initiative';

export type ItemEffect = {
  kind: 'skill' | 'rollMod';
  skill?: LibraryRef; // kind 'skill'; '$mode' = the skill of the mode used (kit pieces)
  roll?: RollKind; // kind 'rollMod'
  value: number;
  active: 'worn' | 'held' | 'inUse' | 'carried';
  scope: 'withItem' | 'any';
  kit?: true; // standard kit: worth EQUIP_FACTOR × the item's need; kit effects share one bonus per roll
};

export type AttackMode = {
  id: string; // an attack mode ID (AM in src/library/tableIds.ts)
  tree: 'melee' | 'ranged' | 'unarmed';
  class: 'light' | 'medium' | 'heavy' | 'punch' | 'slam' | 'grapple';
  skill?: LibraryRef; // unarmed only
  /** how far the mode strikes or shoots, in metres, from real weapons (the library's item rows) */
  reachM: number;
  /** the metres it reaches in use: reachM, plus a thrown weapon's perk metres (ruleset/gear modeReach) */
  reach: number;
  hands: 0 | 1 | 2;
  thrown?: true;
  /** set at use from the attack mode row (Throw): a combined roll, each skill's effective value (its own stand-ins) × its share, summed */
  blend?: { skill: LibraryRef; share: number }[];
  damageAdj?: number;
  hitAdj?: number;
  /** extra skill functions whose skills may stand in for this mode's skill, at the usual share (
   * an improvised melee strike takes Arms stand-ins, an improvised throw takes Ranged ones) */
  standInFns?: SkillFunction[];
  partId?: string; // natural attacks: the Strike part used
  name?: string; // public name for natural modes (packet); else the attackModes row's name
};

export type ItemInstance = {
  id: string;
  itemId: LibraryRef;
  qty?: number;
  equippedIn?: string[]; // 'grip:<grip part id>' | 'armor' | 'acc:<n>'; absent = carried (stowed)
  pools?: Record<string, number>; // % left: 'shield', or a covered part id
  opens?: string[]; // BA3: a key: the barriers (GameState.barriers ids) it locks and unlocks
  boundTo?: string; // D-218: a Threadbound item's owner (actor id)
  usedAt?: Record<string, number>; // D-218: game minute each active ability last fired, by perk id
  at?: { x: number; y: number }; // FR2: where it lies on the ground (a point in its zone); absent while carried
  hiddenAt?: import('./core').TierRoll; // SE8/SE9: lying hidden: a search must beat this outcome tier to find it (a tie gives a hint)
  knownTo?: string[]; // SE8: who knows where a hidden item lies (its stasher, anyone who saw it stashed or found it)
  hiderSkill?: number; // SE25 a: the stasher's true stealth skill when it was stashed: a search learns against it
  /** CT1: a container's contents (a worn pack has none of its own: its wearer's stowed items are in it) */
  contents?: ItemInstance[];
  /** CT1/CT4: the actor a container belongs to; opening or taking from it while they are up and watching is theft */
  owner?: string;
  /** FL6: the actor it was filched from: its owner knows it on sight and won't buy it back */
  stolenFrom?: string;
  /** CT3: a container's lid stands open: its contents can be seen and taken */
  open?: true;
  /** CT3: a locked container: a key naming it (opens) or a Lockpicking roll at its grade opens it, as a lock on a way (BA2) */
  lock?: { locked: boolean };
  grade?: import('./core').Grade;
  beyond?: Record<string, number>; // BA2, as on a barrier
  work?: Record<string, number>; // BA2, as on a barrier
};

export type GearOp = {
  op: 'draw' | 'stow' | 'swap' | 'wear_acc' | 'remove_acc' | 'pick_up' | 'summon'; // summon: TB6, the player's own Threadbound item, from wherever it is
  item: string; // item instance id
  from?: string; // actor id (pick up from a downed or yielded actor); absent = the ground or an open container (CT3)
};
