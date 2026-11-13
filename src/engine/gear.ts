// Part 5 §4: hands, free gear ops, equip and give (main actions), ground items, Destroyed arm drops, thrown items.
import { RL } from '../library/tableIds';
import type { Actor, GameState, GearOp, ImprovisedBase, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { actorBody, itemDef } from '../library';
import { IT } from '../library/itemIds';
import { partStates } from '../ruleset';
import { healthLevel, working } from '../ruleset/body';
import { actorById, isActive, stance, zoneById } from './relations';
import { inContainer, packUp, wearIfNone, wornPack } from './containers';
import { withinGrip, type Located, type Pos } from './position';
import { gripReachM } from '../ruleset/body';
export { gripReachM };
export { withinGrip } from './position';
import { summon } from '../ruleset/threadboundItems';
import { freeAccSlot } from '../ruleset/gear';

export function gripParts(state: GameState, actor: Actor): string[] {
  return actorBody(state, actor).parts.filter((p) => p.roles.includes(RL.grip)).map((p) => p.id);
}

/** SE8: a hidden ground item `a` doesn't know of: out of its view and its reach until a search finds it */
export const hiddenFrom = (i: ItemInstance, a: { id: string }): boolean => !!i.hiddenAt && !i.knownTo?.includes(a.id);

/** FR2: where a pick-up op's item is: on a downed actor, or (CT5) in the pack of one yielded to the taker (their spot);
 * on the ground (its point; one placed with no point lies at its zone's centre, as spotOf reads a spot with none); or
 * (CT3) in an open container (where it stands) */
export function pickUpAt(state: GameState, op: GearOp, taker?: Actor): Located | null {
  if (op.from) { const src = actorById(state, op.from); return src && (!isActive(src) || (!!taker && yieldedTo(state, src, taker))) ? src : null; }
  const z = state.zones.find((x) => x.groundItems.some((i) => i.id === op.item));
  const it = z?.groundItems.find((i) => i.id === op.item);
  if (z && it) return { zone: z.id, ...(it.at ? { pos: it.at } : {}) };
  return taker ? inContainer(state, taker, op.item)?.c.at ?? null : null;
}
/** CT5: `src` yielded to `taker` and wears a pack: its pack (what it carries stowed) is open to them */
const yieldedTo = (state: GameState, src: Actor, taker: Actor) => stance(state, src, taker) === 'yielded' && src.core.inventory.some(wornPack);

function usableFreeHands(state: GameState, actor: Actor): string[] {
  const bad = new Set(partStates(state, actor).filter((p) => !working(p.state)).map((p) => p.id));
  const held = new Set(actor.core.inventory.flatMap((i) => i.equippedIn ?? []));
  return gripParts(state, actor).filter((p) => !bad.has(p) && !held.has(`grip:${p}`)).map((p) => `grip:${p}`);
}

function draw(state: GameState, actor: Actor, inst: ItemInstance): boolean {
  const need = itemDef(state, inst.itemId).hands ?? 1;
  const free = usableFreeHands(state, actor);
  if (inst.equippedIn?.length || free.length < need) return false;
  inst.equippedIn = free.slice(0, need);
  return true;
}

export type GearResult = { picked: { itemId: string; from?: string }[]; summoned: string[]; setDown: { itemId: string; qty?: number }[]; invalid: GearOp[] };

/** free gear ops at the actor's initiative, before its action. Invalid ops are skipped and reported. */
export function applyGearOps(state: GameState, actor: Actor, ops: GearOp[] | null | undefined): GearResult {
  const res: GearResult = { picked: [], summoned: [], setDown: [], invalid: [] };
  for (const op of ops ?? []) {
    const inst = actor.core.inventory.find((i) => i.id === op.item);
    let ok = false;
    switch (op.op) {
      case 'draw':
        // BG-24: drawing what is already in hand is nothing to do, not a mistake
        ok = !!inst && (!!inst.equippedIn?.some((s) => s.startsWith('grip:')) || draw(state, actor, inst));
        break;
      case 'stow':
        ok = !!inst?.equippedIn?.some((s) => s.startsWith('grip:'));
        if (ok) delete inst!.equippedIn;
        break;
      case 'swap': {
        if (!inst || inst.equippedIn?.length) break;
        const held = actor.core.inventory.filter((i) => i.equippedIn?.some((s) => s.startsWith('grip:')));
        const before = held.map((i) => [i, i.equippedIn] as const);
        held.forEach((i) => { if (itemDef(state, i.itemId).kind === 'weapon') delete i.equippedIn; });
        ok = draw(state, actor, inst);
        if (!ok) before.forEach(([i, e]) => (i.equippedIn = e));
        break;
      }
      case 'wear_acc': {
        if (!inst || inst.equippedIn?.length || itemDef(state, inst.itemId).slot !== 'accessory') break;
        // TB6: a Threadbound item is the player's alone: no one else can wear it. WP2: its bond dies with its owner, so the
        // player may take a dead owner's for themselves
        const ownerGone = !!inst.boundTo && healthLevel(actorById(state, inst.boundTo) ?? actor) === 'dead';
        if (itemDef(state, inst.itemId).threadbound && (actor !== state.player || (inst.boundTo && inst.boundTo !== actor.id && !ownerGone))) break;
        const slot = freeAccSlot(actor);
        if (slot) { inst.equippedIn = [slot]; ok = true; }
        if (ok && itemDef(state, inst.itemId).threadbound && (!inst.boundTo || ownerGone)) inst.boundTo = actor.id; // D-218: binds to the player on first wear
        break;
      }
      case 'remove_acc':
        ok = !!inst?.equippedIn?.some((s) => s.startsWith('acc:'));
        if (ok) delete inst!.equippedIn;
        break;
      case 'summon': // TB6: the player's own Threadbound item comes to them from wherever it is, at any time
        ok = summon(state, actor, op.item);
        if (ok) res.summoned.push(op.item);
        break;
      case 'set_down': { // OA4: setting something down where one stands is free, like stowing; worn things come off first
        if (!inst || (inst.equippedIn?.length && !inst.equippedIn.every((s) => s.startsWith('grip:')))) break;
        const n = Math.floor(op.qty ?? inst.qty ?? 1), have = inst.qty ?? 1;
        if (n < 1 || n > have) break;
        if (n < have) {
          inst.qty = have - n;
          const part: ItemInstance = { id: `${inst.id}_down_${state.turn}`, itemId: inst.itemId, qty: n };
          actor.core.inventory.push(part);
          ok = dropToGround(state, actor, part.id, actor.zone);
          if (ok) res.setDown.push({ itemId: part.id, qty: n });
        } else {
          ok = dropToGround(state, actor, inst.id, actor.zone);
          if (ok) res.setDown.push({ itemId: inst.id, ...(inst.qty ? { qty: inst.qty } : {}) });
        }
        break;
      }
      case 'pick_up': {
        // FR2: within grip reach of where it lies (BG-85), on a downed actor or on the ground; CT3: in an open container
        const at = pickUpAt(state, op, actor);
        const src = op.from ? actorById(state, op.from) : undefined;
        const ground = at && !op.from ? zoneById(state, at.zone)?.groundItems : undefined;
        const list = !at || !withinGrip(state, actor, at) ? undefined
          : src ? src.core.inventory : ground?.some((x) => x.id === op.item) ? ground : inContainer(state, actor, op.item)?.list;
        const i = list?.findIndex((x) => x.id === op.item && !hiddenFrom(x, actor)) ?? -1;
        const fixed = i >= 0 && !!itemDef(state, list![i].itemId).container?.fixed; // CT1: a chest stays where it stands
        const guarded = i >= 0 && !!src && isActive(src) && !!list![i].equippedIn?.length; // CT5: a yielded owner's pack only
        if (list && i >= 0 && !fixed && !guarded) {
          const [it] = list.splice(i, 1);
          if (src && wornPack(it)) packUp(src, it); // CT7: a pack taken off its wearer takes what it holds
          delete it.equippedIn;
          delete it.at;
          delete it.hiddenAt;
          delete it.knownTo;
          delete it.hiderSkill;
          actor.core.inventory.push(it);
          wearIfNone(state, actor, it);
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

/** remove an instance from an actor's inventory onto a zone's ground, lying at `at` (default: where the actor stands) */
export function dropToGround(state: GameState, actor: Actor, instId: string, zoneId: string, at: Pos | undefined = actor.zone === zoneId ? actor.pos : undefined): boolean {
  const i = actor.core.inventory.findIndex((x) => x.id === instId);
  const zone = zoneById(state, zoneId);
  if (i < 0 || !zone) return false;
  const [it] = actor.core.inventory.splice(i, 1);
  delete it.equippedIn;
  if (at) it.at = { ...at };
  zone.groundItems.push(it);
  return true;
}

/**
 * give (main action): to another active actor within reach. qty gives part of a stack (null: all of it);
 * a stackable joins the receiver's own stack. Returns the receiver's instance id and the amount given, or null.
 */
export function giveItem(state: GameState, actor: Actor, instId: string | null | undefined, targetId: string | null, qty?: number | null): { id: string; qty: number } | null {
  const to = targetId ? actorById(state, targetId) : undefined;
  const i = actor.core.inventory.findIndex((x) => x.id === instId);
  // FR2 (BG-85): handed over within both their grip reaches, in metres (across a counter too: the straight line over it)
  if (!to || to === actor || !isActive(to) || !withinGrip(state, actor, to, gripReachM(state, to)) || i < 0) return null;
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
  if (moved.stolenFrom === to.id) delete moved.stolenFrom; // FL6: handed back to its owner
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
 * Loot L3: a scenario object the player fights with becomes a story item on its improvised base (the base carries
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
