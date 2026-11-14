// CT1–CT7: containers. A container is an item that holds items (ItemDef.container): a chest or crate standing in a zone, a
// sack carried or set down, a pack worn on the back. A worn pack holds its wearer's stowed items (CT7), so it has no
// contents list of its own until it leaves its wearer. Opening one is the turn's action and shows its contents; taking an
// item out is a pick-up (CT3). A locked one opens with a key naming it or a Lockpicking roll, as a lock on a way (BA2).
// CT4/CT5: opening or taking from a container its owner is up to guard (active and not yielded to the taker) is theft:
// opening it, picking its lock or taking from it is then filching (src/engine/filch.ts).
import type { Actor, GameState, ItemInstance } from '../types';
import { itemDef } from '../library';
import { actorById, allActors, isActive, stance } from './relations';
import type { Located } from './position';

export type Found = { inst: ItemInstance; at: Located; holder?: Actor };

export const isContainer = (state: GameState, i: ItemInstance): boolean => !!itemDef(state, i.itemId).container;
/** CT7: a pack its holder wears */
export const wornPack = (i: ItemInstance): boolean => !!i.equippedIn?.includes('pack');

/** a container by instance id: standing or lying in a zone, or carried by someone (where they stand) */
export function findContainer(state: GameState, id: string | null | undefined): Found | null {
  if (!id) return null;
  for (const z of state.zones) {
    const inst = z.groundItems.find((i) => i.id === id);
    if (inst && isContainer(state, inst)) return { inst, at: { zone: z.id, ...(inst.at ? { pos: inst.at } : {}) } };
  }
  for (const a of allActors(state)) {
    const inst = a.core.inventory.find((i) => i.id === id);
    if (inst && isContainer(state, inst)) return { inst, at: a, holder: a };
  }
  return null;
}

/** what is inside: a worn pack holds its wearer's stowed items (CT7), any other container its own contents */
export function contentsOf(c: Found): ItemInstance[] {
  if (c.holder && wornPack(c.inst)) return c.holder.core.inventory.filter((i) => !i.equippedIn?.length);
  return c.inst.contents ?? [];
}

/** who guards it: its owner, else the one carrying it */
export const ownerOf = (state: GameState, c: Found): Actor | undefined => (c.inst.owner ? actorById(state, c.inst.owner) : undefined) ?? c.holder;

/** CT4/CT5: opening or taking from it would be theft by `a`: its owner is someone else, up, and not yielded to `a` */
export const theft = (state: GameState, a: Actor, c: Found): boolean => guarded(state, a, ownerOf(state, c));
/** CT4/FL2: what `owner` has is guarded from `a`: someone else's, up, and not yielded to `a` */
export const guarded = (state: GameState, a: Actor, owner: Actor | undefined): boolean =>
  !!owner && owner !== a && isActive(owner) && stance(state, owner, a) !== 'yielded';

/** CT3: `a` can reach in: its own, or open and not theft */
export const canTake = (state: GameState, a: Actor, c: Found): boolean => c.holder === a || (!!c.inst.open && !theft(state, a, c));

/** CT3: open it. Locked: a key naming it turns (BA3); without one it stays shut. Returns why not, or null. Guarded, it
 * opens only once filched (CT4: the caller ran the Filching contest). */
export function openContainer(state: GameState, a: Actor, c: Found, filched = false): 'theft' | 'locked' | 'already_open' | null {
  if (!filched && theft(state, a, c)) return 'theft';
  if (c.inst.open) return 'already_open';
  if (c.inst.lock?.locked) {
    if (!a.core.inventory.some((i) => i.opens?.includes(c.inst.id))) return 'locked';
    c.inst.lock.locked = false;
  }
  c.inst.open = true;
  return null;
}

/** CT3: an item inside an open container `a` may take from, with the list it sits in and the container */
export function inContainer(state: GameState, a: Actor, itemId: string): { list: ItemInstance[]; c: Found } | null {
  const cs: Found[] = [
    ...state.zones.flatMap((z) => z.groundItems.filter((i) => isContainer(state, i)).map((inst) => ({ inst, at: { zone: z.id, ...(inst.at ? { pos: inst.at } : {}) } }))),
    ...a.core.inventory.filter((i) => isContainer(state, i) && !wornPack(i)).map((inst) => ({ inst, at: a, holder: a })),
  ];
  for (const c of cs) {
    const list = c.inst.contents ?? [];
    if (list.some((i) => i.id === itemId) && canTake(state, a, c)) return { list, c };
  }
  return null;
}

/** BG-206 (BF29): what lies inside the unlocked containers a person carries, containers in containers too, each with the
 * list that holds it; a locked one keeps its contents shut */
export function carriedContents(state: GameState, inv: ItemInstance[]): { inst: ItemInstance; list: ItemInstance[] }[] {
  const out: { inst: ItemInstance; list: ItemInstance[] }[] = [];
  for (const c of inv) {
    if (!isContainer(state, c) || c.lock?.locked || !c.contents?.length) continue;
    for (const inst of c.contents) out.push({ inst, list: c.contents });
    out.push(...carriedContents(state, c.contents));
  }
  return out;
}

/** CT7: a worn pack taken off its wearer (picked up from a downed or yielded one) takes their stowed items with it */
export function packUp(holder: Actor, pack: ItemInstance): void {
  const stowed = holder.core.inventory.filter((i) => i !== pack && !i.equippedIn?.length && !i.soulbound); // HF18: soulbound gear stays with its owner
  holder.core.inventory = holder.core.inventory.filter((i) => !stowed.includes(i));
  pack.contents = [...(pack.contents ?? []), ...stowed];
}

/** CT7: a pack picked up by someone who wears none is put on, and what it held joins their stowed items */
export function wearIfNone(state: GameState, a: Actor, inst: ItemInstance): void {
  if (!itemDef(state, inst.itemId).container?.worn || a.core.inventory.some((i) => i !== inst && wornPack(i))) return;
  inst.equippedIn = ['pack'];
  a.core.inventory.push(...(inst.contents ?? []));
  delete inst.contents;
}
