// Part 5 §4: hands, free gear ops, equip and give (main actions), ground items, Destroyed arm drops, thrown items.
import { RL } from '../library/tableIds';
import type { Actor, GameState, GearOp, ImprovisedBase, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { actorBody, itemDef } from '../library';
import { IT } from '../library/itemIds';
import { partStates } from '../ruleset';
import { actorById, isActive, zoneById } from './relations';

export function gripParts(state: GameState, actor: Actor): string[] {
  return actorBody(state, actor).parts.filter((p) => p.roles.includes(RL.grip)).map((p) => p.id);
}

function usableFreeHands(state: GameState, actor: Actor): string[] {
  const bad = new Set(partStates(state, actor).filter((p) => p.state === 'Crippled' || p.state === 'Destroyed').map((p) => p.id));
  const held = new Set(actor.core.inventory.flatMap((i) => i.equippedIn ?? []));
  return gripParts(state, actor).filter((p) => !bad.has(p) && !held.has(`hand:${p}`)).map((p) => `hand:${p}`);
}

function draw(state: GameState, actor: Actor, inst: ItemInstance): boolean {
  const need = itemDef(state, inst.itemId).hands ?? 1;
  const free = usableFreeHands(state, actor);
  if (inst.equippedIn?.length || free.length < need) return false;
  inst.equippedIn = free.slice(0, need);
  return true;
}

export type GearResult = { picked: { itemId: string; from?: string }[]; invalid: GearOp[] };

/** free gear ops at the actor's initiative, before its action. Invalid ops are skipped and reported. */
export function applyGearOps(state: GameState, actor: Actor, ops: GearOp[] | null | undefined): GearResult {
  const res: GearResult = { picked: [], invalid: [] };
  for (const op of ops ?? []) {
    const inst = actor.core.inventory.find((i) => i.id === op.item);
    let ok = false;
    switch (op.op) {
      case 'draw':
        // BG-24: drawing what is already in hand is nothing to do, not a mistake
        ok = !!inst && (!!inst.equippedIn?.some((s) => s.startsWith('hand:')) || draw(state, actor, inst));
        break;
      case 'stow':
        ok = !!inst?.equippedIn?.some((s) => s.startsWith('hand:'));
        if (ok) delete inst!.equippedIn;
        break;
      case 'swap': {
        if (!inst || inst.equippedIn?.length) break;
        const held = actor.core.inventory.filter((i) => i.equippedIn?.some((s) => s.startsWith('hand:')));
        const before = held.map((i) => [i, i.equippedIn] as const);
        held.forEach((i) => { if (itemDef(state, i.itemId).kind === 'weapon') delete i.equippedIn; });
        ok = draw(state, actor, inst);
        if (!ok) before.forEach(([i, e]) => (i.equippedIn = e));
        break;
      }
      case 'wear_acc': {
        if (!inst || inst.equippedIn?.length || itemDef(state, inst.itemId).slot !== 'accessory') break;
        const used = new Set(actor.core.inventory.flatMap((i) => i.equippedIn ?? []));
        const slot = Array.from({ length: CONFIG.ACCESSORY_SLOTS }, (_, n) => `acc:${n}`).find((s) => !used.has(s));
        if (slot) { inst.equippedIn = [slot]; ok = true; }
        if (ok && itemDef(state, inst.itemId).threadbound) inst.boundTo ??= actor.id; // D-218: binds to the first who wears it
        break;
      }
      case 'remove_acc':
        ok = !!inst?.equippedIn?.some((s) => s.startsWith('acc:'));
        if (ok) delete inst!.equippedIn;
        break;
      case 'pick_up': {
        const src = op.from ? actorById(state, op.from) : undefined;
        const list = op.from
          ? src && src.zone === actor.zone && !isActive(src) ? src.core.inventory : undefined
          : zoneById(state, actor.zone)?.groundItems;
        const i = list?.findIndex((x) => x.id === op.item) ?? -1;
        if (list && i >= 0) {
          const [it] = list.splice(i, 1);
          delete it.equippedIn;
          actor.core.inventory.push(it);
          res.picked.push({ itemId: it.id, from: op.from });
          ok = true;
        }
        break;
      }
    }
    if (!ok) res.invalid.push(op);
  }
  return res;
}

/** remove an instance from an actor's inventory onto a zone's ground. */
export function dropToGround(state: GameState, actor: Actor, instId: string, zoneId: string): boolean {
  const i = actor.core.inventory.findIndex((x) => x.id === instId);
  const zone = zoneById(state, zoneId);
  if (i < 0 || !zone) return false;
  const [it] = actor.core.inventory.splice(i, 1);
  delete it.equippedIn;
  zone.groundItems.push(it);
  return true;
}

/**
 * give (main action): to another active actor in the same zone. qty gives part of a stack (null: all of it);
 * a stackable joins the receiver's own stack. Returns the receiver's instance id and the amount given, or null.
 */
export function giveItem(state: GameState, actor: Actor, instId: string | null | undefined, targetId: string | null, qty?: number | null): { id: string; qty: number } | null {
  const to = targetId ? actorById(state, targetId) : undefined;
  const i = actor.core.inventory.findIndex((x) => x.id === instId);
  if (!to || to === actor || !isActive(to) || to.zone !== actor.zone || i < 0) return null;
  const it = actor.core.inventory[i];
  const have = it.qty ?? 1;
  const stackable = itemDef(state, it.itemId).stackable;
  const n = qty == null || !stackable ? have : Math.floor(qty);
  if (n < 1 || n > have) return null;
  const stack = stackable ? to.core.inventory.find((x) => x.itemId === it.itemId) : undefined;
  if (n < have) it.qty = have - n;
  else actor.core.inventory.splice(i, 1);
  if (stack) {
    stack.qty = (stack.qty ?? 1) + n;
    return { id: stack.id, qty: n };
  }
  const moved: ItemInstance = n < have ? { id: `${it.id}_${to.id}_${state.turn}`, itemId: it.itemId, qty: n } : it;
  delete moved.equippedIn;
  to.core.inventory.push(moved);
  return { id: moved.id, qty: n };
}

/** equip (main action): put armor on (taking off any worn armor), or take it off when worn. */
export function equipArmor(state: GameState, actor: Actor, instId: string | null | undefined): boolean {
  const inst = actor.core.inventory.find((x) => x.id === instId);
  if (!inst || itemDef(state, inst.itemId).slot !== 'armor') return false;
  if (inst.equippedIn?.includes('armor')) {
    delete inst.equippedIn;
    return true;
  }
  if (inst.equippedIn?.length) return false;
  actor.core.inventory.forEach((i) => { if (i.equippedIn?.includes('armor')) delete i.equippedIn; });
  inst.equippedIn = ['armor'];
  return true;
}

/**
 * Loot L3: a scene object the player fights with becomes a story item on its improvised base (the base carries
 * IMPROVISED_HIT_ADJ). It goes into the actor's inventory; the caller draws it. Returns the instance id.
 */
/** the Parser's improvised base words and their library items */
export const IMPROVISED_ITEM: Record<ImprovisedBase, string> = { improvised_light: IT.improvised_light, improvised_medium: IT.improvised_medium, improvised_heavy: IT.improvised_heavy };
export function improvise(state: GameState, actor: Actor, imp: { base: ImprovisedBase; name: string }): string {
  const base = itemDef(state, IMPROVISED_ITEM[imp.base]);
  const id = `${base.id}_i${state.turn}`;
  const name = imp.name.trim().slice(0, CONFIG.TEXT_CAP) || base.name;
  if (!state.blueprints.some((b) => b.id === id))
    state.blueprints.push({ storyId: state.storyId, id, kind: 'item', data: { ...structuredClone(base), id, name, look: name } as unknown as Record<string, unknown> });
  const inst: ItemInstance = { id: `${id}_${actor.id}`, itemId: id };
  actor.core.inventory.push(inst);
  return inst.id;
}
