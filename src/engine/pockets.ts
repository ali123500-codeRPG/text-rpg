// PO1-PO3: pockets. Everyone has CONFIG.POCKET_SLOTS pockets outside the pack, each holding one item (a stack counts as
// one) no bulkier than CONFIG.POCKET_MAX_BULK; a worn piece with ItemDef.pockets (a belt with pouches, a bandolier) adds
// its own. A pocketed item is stowed (no equippedIn) with ItemInstance.pocket naming its pocket; a worn pack holds the
// rest of what is stowed (CT7). PO2: in a fight, getting something out of the pack (or a sack one carries), or moving it
// between pack and pocket, takes the Action times row DU.from_pack (one fight turn: the action) on top of the op's own; from
// a pocket it is as quick as drawing a weapon. Out of a fight it makes no difference. PO3: what someone picks up, is given, buys or filches goes
// into a free pocket if it fits, else the pack.
import type { Actor, GameState, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { wornPack } from './containers';

/** every pocket `a` has: its own, then those of the pieces it wears */
export function pocketSlots(state: GameState, a: Actor): string[] {
  const own = Array.from({ length: CONFIG.POCKET_SLOTS }, (_, n) => `pocket:${n + 1}`);
  const gear = a.core.inventory.filter((i) => i.equippedIn?.length).flatMap((i) => Array.from({ length: itemDef(state, i.itemId).pockets ?? 0 }, (_, n) => `${i.id}:${n + 1}`));
  return [...own, ...gear];
}

/** a pocket free of anything, if any */
export function freePocket(state: GameState, a: Actor): string | undefined {
  const used = new Set(a.core.inventory.map((i) => i.pocket).filter(Boolean));
  return pocketSlots(state, a).find((p) => !used.has(p));
}

/** small enough for a pocket, and not worn, held or a container */
export const fitsPocket = (state: GameState, i: ItemInstance): boolean => {
  const d = itemDef(state, i.itemId);
  return !i.equippedIn?.length && d.bulk <= CONFIG.POCKET_MAX_BULK && !d.container;
};

/** PO3: put a stowed item `a` carries into a free pocket if it fits. True when it is in one */
export function pocketIt(state: GameState, a: Actor, i: ItemInstance): boolean {
  if (i.pocket) return true;
  const p = fitsPocket(state, i) ? freePocket(state, a) : undefined;
  if (p) i.pocket = p;
  return !!p;
}

/** PO1: pockets that no longer exist (the piece that had them came off or left) give their items back to the pack */
export function tidyPockets(state: GameState, a: Actor): void {
  const slots = new Set(pocketSlots(state, a));
  for (const i of a.core.inventory) if (i.pocket && (i.equippedIn?.length || !slots.has(i.pocket))) delete i.pocket;
}

/** PO2: is this stowed item in the pack `a` wears (not in a pocket, not held or worn) */
export const inPack = (a: Actor, i: ItemInstance): boolean =>
  !i.equippedIn?.length && !i.pocket && a.core.inventory.includes(i) && a.core.inventory.some((x) => x !== i && wornPack(x));

/** the pocket's name for the story and the screen: "pocket", or the worn piece's ("belt with pouches") */
export function pocketName(state: GameState, a: Actor, pocket: string): string {
  if (pocket.startsWith('pocket:')) return 'pocket';
  const gear = a.core.inventory.find((i) => pocket.startsWith(`${i.id}:`));
  return gear ? itemDef(state, gear.itemId).name : 'pocket';
}
