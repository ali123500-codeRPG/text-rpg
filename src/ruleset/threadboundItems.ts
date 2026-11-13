// D-218 Threadbound items: one of a kind in the world, bound to the first who wears one. While the owner wears it, each
// of its grants gives the grant's perk (source 'item') once the owner has earned the grant's achievement (a replaced
// lower level still counts as earned). In anyone else's hands it gives nothing. Runs at the end of every turn.
import type { Actor, GameState, ItemDef, ItemInstance, Turn } from '../types';
import { getLibrary } from '../library';
import { createRng } from '../rng';
import { freeAccSlot, isWorn } from './gear';
import { THREADBOUND_RANKS } from '../scales';
import { now } from '../time';

const libItem = (id: string): ItemDef | undefined => getLibrary().items[id];

/** the actor has earned this achievement, even if a higher level has since replaced it */
export const earned = (a: Actor, achievement: string) => !!a.progression?.achievements?.some((x) => x.key === achievement);

/** the Threadbound items the actor wears and owns */
export const ownThreadboundItems = (a: Actor): ItemInstance[] =>
  a.core.inventory.filter((i) => i.boundTo === a.id && isWorn(i) && libItem(i.itemId)?.threadbound);

/** the perks the actor's worn Threadbound items give now */
export function threadboundItemPerks(a: Actor): string[] {
  return ownThreadboundItems(a).flatMap((i) => libItem(i.itemId)!.threadbound!.grants.filter((g) => earned(a, g.achievement)).map((g) => g.perk));
}

/** adds the perks the actor's worn Threadbound items give and takes away those they no longer give */
export function syncThreadboundItemPerks(a: Actor, turn: Turn): void {
  const want = new Set(threadboundItemPerks(a));
  a.core.perks = a.core.perks.filter((p) => p.source !== 'item' || want.has(p.perkId));
  for (const id of want) if (!a.core.perks.some((p) => p.perkId === id && p.source === 'item')) a.core.perks.push({ perkId: id, source: 'item', gainedTurn: turn });
}

/** the worn Threadbound item that gives this perk to the actor */
export const threadboundItemFor = (a: Actor, perk: string): ItemInstance | undefined =>
  ownThreadboundItems(a).find((i) => libItem(i.itemId)!.threadbound!.grants.some((g) => g.perk === perk));

/** a Threadbound item is one of a kind: true when one is already carried by anyone or lies on any ground */
export const inWorld = (state: GameState, itemId: string): boolean => itemHolders(state).some((l) => l.some((i) => i.itemId === itemId && !i.soulbound)); // HF19: an echo's soulbound copy is not the one

/** every place an item instance can be: each actor's inventory and each zone's ground, in every place */
export function itemHolders(state: GameState): ItemInstance[][] {
  return [...[state.player, ...state.actors].map((a) => a.core.inventory), ...state.places.flatMap((p) => p.zones.map((z) => z.groundItems))];
}

/** TB6: the actor's bound Threadbound items it is not carrying */
export const summonableThreadboundItems = (state: GameState, a: Actor): ItemInstance[] =>
  itemHolders(state).filter((l) => l !== a.core.inventory).flat().filter((i) => i.boundTo === a.id && libItem(i.itemId)?.threadbound);

/** TB6: brings the actor's own Threadbound item to it from wherever it is; it lands worn if a slot for it is free, else
 * stowed (TB12). False if it isn't theirs */
export function summon(state: GameState, a: Actor, instId: string): boolean {
  for (const list of itemHolders(state)) {
    const i = list.findIndex((x) => x.id === instId);
    if (i < 0) continue;
    if (list === a.core.inventory || list[i].boundTo !== a.id || !libItem(list[i].itemId)?.threadbound) return false;
    const [it] = list.splice(i, 1);
    delete it.equippedIn;
    a.core.inventory.push(it);
    const slot = libItem(it.itemId)!.slot === 'accessory' ? freeAccSlot(a) : undefined;
    if (slot) it.equippedIn = [slot];
    return true;
  }
  return false;
}

/** TB7: each owned perk with grantsThreadboundItem gives, once, a random Threadbound item of at least its Rank (TB11) not
 * yet in the world (state given), bound to the owner and worn in a free accessory slot. The pick is seeded by the story
 * id, so a replay gives the same. */
export function grantThreadboundItem(a: Actor, state?: GameState): void {
  const lib = getLibrary();
  for (const p of a.core.perks) {
    const grant = lib.perks[p.perkId]?.grantsThreadboundItem;
    if (p.dormant || p.granted || !grant) continue;
    const free = Object.values(lib.items).filter((d) => d.threadbound && THREADBOUND_RANKS.pos(d.threadbound.rank) >= THREADBOUND_RANKS.pos(grant.minRank)
      && !(state && inWorld(state, d.id)) && !a.core.inventory.some((i) => i.itemId === d.id));
    if (!free.length) continue;
    const pick = free[createRng([...a.storyId].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) || 1).int(0, free.length - 1)];
    const slot = pick.slot === 'accessory' ? freeAccSlot(a) : undefined;
    a.core.inventory.push({ id: `${pick.id}_${a.id}`, itemId: pick.id, boundTo: a.id, ...(slot ? { equippedIn: [slot] } : {}) });
    p.granted = pick.id;
  }
}

/** D-218: the active ability that fires by itself on this essence quality roll: of the owner's item abilities with essenceAuto
 * whose cooldown has passed, the one with the longest cooldown (All or Nothing before Call the Toss); one per roll. It starts
 * its cooldown. Undefined when none is ready. */
export function fireEssenceAuto(state: GameState, a: Actor): { perk: string; kind: 'farther' | 'all_or_nothing' } | undefined {
  const lib = getLibrary(), t = now(state);
  const ready = a.core.perks.filter((p) => !p.dormant && p.source === 'item' && lib.perks[p.perkId]?.essenceAuto)
    .map((p) => ({ perk: p.perkId, auto: lib.perks[p.perkId]!.essenceAuto!, inst: threadboundItemFor(a, p.perkId) }))
    .filter((x) => x.inst && (x.inst.usedAt?.[x.perk] === undefined || t - x.inst.usedAt[x.perk] >= x.auto.cooldownMin))
    .sort((x, y) => y.auto.cooldownMin - x.auto.cooldownMin);
  const f = ready[0];
  if (!f) return undefined;
  (f.inst!.usedAt ??= {})[f.perk] = t;
  return { perk: f.perk, kind: f.auto.kind };
}
