// BF34: giving and taking are trades at no price, open with anyone: no haggle, no list of their things shown. A give holds
// the item out (Actor.offer); it changes hands when the other side takes it, by the end of the next turn. A take is yours
// at once from someone holding it out to you, yielded or surrendered to you, down or asleep; anyone else refuses, and
// grabbing it is filching. Grips must reach both ways.
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { STANCES } from '../scales';
import { gripReachM, usableGrips } from '../ruleset/body';
import type { Actor, GameState, ItemInstance } from '../types';
import { carriedContents } from './containers';
import { actorById, isActive, isAsleep, stance } from './relations';
import { withinGrip } from './position';

/** where an item an actor carries lies: on them, or in one of their unlocked bags (BG-195) */
export function carriedItem(state: GameState, a: Actor, instId: string | null | undefined): { list: ItemInstance[]; inst: ItemInstance } | null {
  if (!instId) return null;
  const top = a.core.inventory.find((x) => x.id === instId);
  if (top) return { list: a.core.inventory, inst: top };
  const deep = carriedContents(state, a.core.inventory).find((x) => x.inst.id === instId);
  return deep ? { list: deep.list, inst: deep.inst } : null;
}

/** the hand-over itself: `qty` of the item (null: all of it) moves from `from` to `to`; returns the instance `to` now has */
export function transfer(state: GameState, from: Actor, to: Actor, instId: string, qty?: number | null): { id: string; qty: number } | null {
  const at = carriedItem(state, from, instId);
  if (!at || at.inst.soulbound) return null; // HF18
  const it = at.inst, have = it.qty ?? 1, stackable = itemDef(state, it.itemId).stackable;
  const n = qty == null || !stackable ? have : Math.floor(qty);
  if (n < 1 || n > have) return null;
  if (n < have) it.qty = have - n;
  else at.list.splice(at.list.indexOf(it), 1);
  const stack = stackable ? to.core.inventory.find((x) => x.itemId === it.itemId) : undefined;
  if (stack) { stack.qty = (stack.qty ?? 1) + n; return { id: stack.id, qty: n }; }
  const moved: ItemInstance = n < have ? { id: `${it.id}_${to.id}_${state.turn}`, itemId: it.itemId, qty: n } : it;
  delete moved.equippedIn;
  if (moved.stolenFrom === to.id) delete moved.stolenFrom; // FL6: handed back to its owner
  to.core.inventory.push(moved);
  return { id: moved.id, qty: n };
}

/** grips reach both ways: within both grip reaches, in metres (FR2, BG-85) */
export const gripsReach = (state: GameState, a: Actor, b: Actor): boolean => withinGrip(state, a, b, gripReachM(state, b));

/** why a give can't be held out, or null: someone else, up, in reach, and the item carried (a bag of one's own included) */
export function offerBlock(state: GameState, a: Actor, to: Actor | undefined, instId: string | null | undefined, qty?: number | null): string | null {
  if (!to || to === a) return 'no_one_to_give_to';
  if (!isActive(to)) return 'already_down';
  const at = carriedItem(state, a, instId);
  if (!at || at.inst.soulbound) return 'no_item';
  if (!gripsReach(state, a, to)) return 'out_of_reach';
  if (qty != null && itemDef(state, at.inst.itemId).stackable && (qty < 1 || qty > (at.inst.qty ?? 1))) return 'not_that_many';
  return null;
}

/** BF34: `a` holds the item out to `to` (it stays a's until taken) */
export function holdOut(state: GameState, a: Actor, to: Actor, instId: string, qty?: number | null): void {
  a.offer = { item: instId, to: to.id, turn: state.turn, ...(qty != null ? { qty } : {}) };
}

/** BF34: what `taker` may take from `owner` at once, and how: held out to them, or owner yielded or surrendered to them,
 * down or asleep; else why not */
export function takeBlock(state: GameState, taker: Actor, owner: Actor | undefined, instId: string | null | undefined): { how: 'offered' | 'helpless' } | { why: string } {
  if (!owner || owner === taker) return { why: 'no_one_to_take_from' };
  const at = carriedItem(state, owner, instId);
  if (!at || at.inst.soulbound) return { why: 'no_item' };
  if (!gripsReach(state, taker, owner)) return { why: 'out_of_reach' };
  if (owner.offer?.to === taker.id && owner.offer.item === at.inst.id) return { how: 'offered' };
  const gaveUp = stance(state, owner, taker) === 'yielded' || owner.mind?.moraleState === 'surrendered';
  if (!isActive(owner) || isAsleep(owner) || gaveUp) return { how: 'helpless' };
  return { why: 'refused' };
}

/** BF34: an NPC no agent answered for takes what is held out to it this turn when it can hold it and is at least
 * CONFIG.TAKE_FROM_STANCE (neutral) toward the giver: people take a free thing from those they don't mind */
export function wantsOffer(state: GameState, npc: Actor, giver: Actor): boolean {
  if (!isActive(npc) || isAsleep(npc) || !usableGrips(state, npc).length) return false;
  const s = stance(state, npc, giver);
  return s !== 'yielded' && STANCES.pos(s as never) >= STANCES.pos(CONFIG.TAKE_FROM_STANCE as never);
}

/** the offer `giver` holds out, if it still stands and is for `to` */
export const offerTo = (state: GameState, giver: Actor, to: string): Actor['offer'] | undefined =>
  giver.offer?.to === to && !!actorById(state, to) && !!carriedItem(state, giver, giver.offer.item) ? giver.offer : undefined;
