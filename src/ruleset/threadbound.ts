// D-218 Threadbound items: one of a kind in the world, bound to the first who wears one. While the owner wears it, each
// of its grants gives the grant's perk (source 'item') once the owner has earned the grant's achievement (a replaced
// lower level still counts as earned). In anyone else's hands it gives nothing. Runs at the end of every turn.
import type { Actor, GameState, ItemDef, ItemInstance, Turn } from '../types';
import { getLibrary } from '../library';
import { isWorn } from './gear';

const libItem = (id: string): ItemDef | undefined => getLibrary().items[id];

/** the actor has earned this achievement, even if a higher level has since replaced it */
export const earned = (a: Actor, achievement: string) => !!a.progression?.achievements?.some((x) => x.key === achievement);

/** the Threadbound items the actor wears and owns */
export const ownThreadbound = (a: Actor): ItemInstance[] =>
  a.core.inventory.filter((i) => i.boundTo === a.id && isWorn(i) && libItem(i.itemId)?.threadbound);

/** the perks the actor's worn Threadbound items give now */
export function threadboundPerks(a: Actor): string[] {
  return ownThreadbound(a).flatMap((i) => libItem(i.itemId)!.threadbound!.grants.filter((g) => earned(a, g.achievement)).map((g) => g.perk));
}

/** adds the perks the actor's worn Threadbound items give and takes away those they no longer give */
export function syncThreadbound(a: Actor, turn: Turn): void {
  const want = new Set(threadboundPerks(a));
  a.core.perks = a.core.perks.filter((p) => p.source !== 'item' || want.has(p.perkId));
  for (const id of want) if (!a.core.perks.some((p) => p.perkId === id && p.source === 'item')) a.core.perks.push({ perkId: id, source: 'item', gainedTurn: turn });
}

/** the worn Threadbound item that gives this perk to the actor */
export const threadboundOf = (a: Actor, perk: string): ItemInstance | undefined =>
  ownThreadbound(a).find((i) => libItem(i.itemId)!.threadbound!.grants.some((g) => g.perk === perk));

/** a Threadbound item is one of a kind: true when one is already carried by anyone or lies on any ground */
export const inWorld = (state: GameState, itemId: string): boolean =>
  [state.player, ...state.actors].some((a) => a.core.inventory.some((i) => i.itemId === itemId))
  || state.places.some((p) => p.zones.some((z) => z.groundItems.some((i) => i.itemId === itemId)));
