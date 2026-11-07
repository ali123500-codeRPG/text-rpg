// Part 4 §9 (ItemDef, ItemInstance) and Part 5.
import type { LibraryRef } from './core';

export type ItemDef = {
  id: LibraryRef;
  kind: 'weapon' | 'armor' | 'shield' | 'accessory' | 'tool' | 'consumable' | 'misc';
  name: string;
  look: string; // public text
  bulk: 0 | 1 | 2 | 3;
  value: number;
  heal?: string; // a healing source id (H2): using the item applies that row and uses it up
  boon?: number; // hand-set Boon, overrides value ÷ BOON_COIN (loot V8b)
  stackable?: true;
  consumable?: true;
  concealed?: true;
  visible?: true;
  slot?: 'armor' | 'accessory';
  hands?: 1 | 2;
  effects?: ItemEffect[];
  weapon?: { modes: AttackMode[] };
  armor?: {
    covers: string[];
    reduction: number;
    multiplier: number;
    weight: 'light' | 'medium' | 'heavy';
    pools?: Record<string, number>;
  };
  shield?: { pool: number };
  base?: { itemId: LibraryRef; quality: 1 | 2 | 3 | 4; boosts: string };
  tags?: string[]; // 'kit' marks a standard-kit piece (one shared +25 per roll)
};

export type RollKind = 'hit' | 'dodge' | 'block' | 'perception' | 'stealth' | 'situation';

export type ItemEffect = {
  kind: 'skill' | 'rollMod';
  skill?: LibraryRef; // kind 'skill'; '$mode' = the skill of the mode used (kit pieces)
  roll?: RollKind; // kind 'rollMod'
  value: number;
  active: 'worn' | 'held' | 'inUse' | 'carried';
  scope: 'withItem' | 'any';
  kit?: true; // standard kit: all kit effects share one KIT_BONUS per roll
};

export type AttackMode = {
  id: string;
  tree: 'melee' | 'ranged' | 'unarmed';
  class: 'light' | 'medium' | 'heavy' | 'punch' | 'slam';
  skill?: LibraryRef; // unarmed only
  reach: number;
  hands: 0 | 1 | 2;
  thrown?: true;
  damageAdj?: number;
  hitAdj?: number;
  partId?: string; // natural attacks: the Strike part used
  name?: string; // public name for natural modes (packet)
};

export type ItemInstance = {
  id: string;
  itemId: LibraryRef;
  qty?: number;
  equippedIn?: string[]; // 'hand:<gripPartId>' | 'armor' | 'acc:<n>'; absent = carried (stowed)
  pools?: Record<string, number>; // % left: 'shield', or a covered part id
};

export type GearOp = {
  op: 'draw' | 'stow' | 'swap' | 'wear_acc' | 'remove_acc' | 'pick_up';
  item: string; // item instance id
  from?: string; // actor id (pick up from a downed actor) ; absent = ground
};
