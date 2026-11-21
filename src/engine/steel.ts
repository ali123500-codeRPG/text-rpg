// Steel drawn or sheathed (DS1–DS7). Weapons start sheathed (DS2: library/spawn.ts) and code draws them when it matters: for
// anyone who attacks or is attacked with no weapon in hand, and for an NPC that is not calm (in a fight or alarmed); a calm
// NPC sheathes again what it did not draw on purpose. Drawing and sheathing stay free and instant (DS7, ACT-36). Going
// between steel drawn and sheathed is an event others see and hear close by, but not when the actor attacks that turn
// (DS1); a swap or any other change of gear is none. A draw on purpose outside a fight is a deed (DS4): the one it is drawn
// at turns a step colder and a guard who sees it in a settlement is alarmed. A sheathe on purpose before someone hostile or
// opposed is an offer to stand down that an AI-run foe or the player answers (DS5, engine/offer.ts). Power rates every
// actor as drawn whatever it holds (BG-1583).
import type { Actor, GameEvent, GameState, GearOp, ItemInstance, Order } from '../types';
import { itemDef } from '../library';
import { isHeld, isWorn, modeSkill } from '../ruleset/gear';
import { readied } from './combatLevel';
import { actorById, allActors, atLeast, hostile, inSettlement, isActive, isAsleep, nameFor, stance } from './relations';
import { stepStance, logCode } from './effects';
import { applyMemoryOps } from './memory';
import { isGuard } from './suspicion';
import { isCalm, raiseAlarm } from '../minds/state';
import { applyGearOps } from './gear';

const isArm = (state: GameState, i: ItemInstance) => { const d = itemDef(state, i.itemId); return !!d.weapon || !!d.shield; };
/** the weapons the actor holds (a shield alone is not steel drawn) */
export const heldWeapons = (state: GameState, a: Actor): ItemInstance[] => a.core.inventory.filter((i) => isHeld(i) && !!itemDef(state, i.itemId).weapon);
/** DS1: steel drawn: a weapon in hand */
export const armed = (state: GameState, a: Actor): boolean => heldWeapons(state, a).length > 0;
/** the gear ops by which an order draws or sheathes on purpose */
const steelOps = (ops: GearOp[]) => ops.some((op) => op.op === 'draw' || op.op === 'stow' || op.op === 'swap');

const fought = new Map<string, Record<string, string[]>>();
/** DS7 (drawing is social, never a gate): the actor as it fights: itself with steel in hand, else a copy holding the set
 * it would draw (drawToFight). The figures shown for it (standing attack and defense, reach) read this, never only what is
 * in hand. Remembered by sheet, so a view built every turn does not rate the sets again. */
export function asFought(state: GameState, a: Actor): Actor {
  if (armed(state, a)) return a;
  const c: Actor = { ...a, core: { ...a.core, inventory: a.core.inventory.map((i) => ({ ...i })) } };
  const key = JSON.stringify([c.core.inventory.map((i) => [i.id, i.itemId, i.equippedIn]), a.core.skills, a.core.perks, a.core.condition.parts]);
  const hit = fought.get(key);
  if (hit) for (const i of c.core.inventory) { if (hit[i.id]) i.equippedIn = hit[i.id]; }
  else {
    readied(state, c, true);
    if (fought.size > 50) fought.clear();
    fought.set(key, Object.fromEntries(c.core.inventory.filter((i) => isHeld(i)).map((i) => [i.id, i.equippedIn!])));
  }
  return c;
}

/** DS2/DS7: `a` (attacked, or attacking) takes up its weapons if it holds none: the one its order names when it carries it,
 * else the set it carries that rates highest, into its free grips. Free and instant. */
export function drawToFight(state: GameState, a: Actor, named?: string | null): void {
  if (armed(state, a) || !isActive(a) || isAsleep(a)) return;
  const inst = named ? a.core.inventory.find((i) => i.id === named && !isHeld(i) && !isWorn(i)) : undefined;
  if (inst && itemDef(state, inst.itemId).weapon) applyGearOps(state, a, [{ op: 'swap', item: inst.id }]);
  else readied(state, a, true);
}

/** DS7 (drawing is social, never a gate): an order that takes up steel: a break, or an attack naming a weapon it carries, or naming no weapon and no blow of the body (a punch
 * names its body mode: it keeps the hands empty) */
export function attackDraws(state: GameState, a: Actor, o: Order): boolean {
  if (o.type === 'break') return true; // breaking or forcing open uses the blade or heavy weapon it carries (a cut, Shield Breaker)
  if (o.type !== 'attack' || o.item === 'unarmed' || o.item?.startsWith('natural:')) return false;
  if (o.item || (!o.mode && !o.skill)) return true;
  return a.core.inventory.some((i) => itemDef(state, i.itemId).weapon?.modes.some((m) => (!o.mode || m.id === o.mode) && (!o.skill || modeSkill(m) === o.skill)));
}

/** DS2: it is about to fight: hostile to someone active it is aware of */
const foeKnown = (state: GameState, a: Actor): boolean =>
  allActors(state).some((x) => x !== a && isActive(x) && hostile(state, a, x) && atLeast(a.mind?.knowledge[x.id]?.status, 'aware'));

/** DS2: an NPC about to fight: not calm, or hostile to someone it knows is there */
const ready = (state: GameState, a: Actor): boolean => !isCalm(state, a) || foeKnown(state, a);
/** DS2: at the turn's start, before anyone decides, code draws for an NPC about to fight */
export function steelBefore(state: GameState, a: Actor): void {
  if (a.kind === 'npc' && a.mind && !a.mind.moraleState && !isAsleep(a) && ready(state, a)) drawToFight(state, a);
}
/** DS2: as it acts, a calm NPC that does not attack and chose no draw or sheathe of its own puts away the steel it did not
 * draw on purpose; an order's own draw or sheathe is its choice and is remembered (noteChoice: mind.drawnOnPurpose) */
export function sheatheIfCalm(state: GameState, a: Actor, o: Order): void {
  if (a.kind !== 'npc' || !a.mind || a.mind.drawnOnPurpose || o.type === 'attack' || steelOps(o.gear ?? []) || ready(state, a)) return;
  for (const i of a.core.inventory) if (isHeld(i) && isArm(state, i)) delete i.equippedIn;
}
/** after the actor's gear ops: whether it drew or sheathed by choice, kept on its mind until it next chooses */
export function noteChoice(state: GameState, a: Actor, ops: GearOp[]): void {
  if (!a.mind || !steelOps(ops)) return;
  if (armed(state, a)) a.mind.drawnOnPurpose = true;
  else delete a.mind.drawnOnPurpose;
}

/** DS1: the event a change between drawn and sheathed makes (its kind, the weapon, and whom it is at), or none: no change,
 * or the actor attacks this turn */
export function steelEvent(state: GameState, a: Actor, o: Order, before: ItemInstance[]): Pick<GameEvent, 'kind' | 'itemId' | 'target'> | undefined {
  const now = heldWeapons(state, a);
  if (!now.length === !before.length || o.type === 'attack' || o.type === 'break') return undefined;
  const t = o.target && o.target !== a.id ? o.target : undefined;
  return { kind: now.length ? 'draw_weapon' : 'sheathe_weapon', itemId: (now[0] ?? before[0]).itemId, ...(t ? { target: t } : {}) };
}

/** DS4/DS5: what a draw or sheathe on purpose (`ev`, already perceived) sets off. Drawn outside a fight: the one it is drawn
 * at turns one step colder and remembers it; every guard not of the drawer's band who sees it in a settlement is alarmed.
 * Sheathed: everyone who sees it and is hostile or opposed to the actor, AI-run or the player, is offered a stand-down. */
export function steelDeed(state: GameState, a: Actor, ev: GameEvent, ops: GearOp[]): void {
  if (!steelOps(ops)) return;
  const saw = (x: Actor) => x !== a && isActive(x) && !isAsleep(x) && ev.perception[x.id]?.level === 'full';
  if (ev.kind === 'draw_weapon') {
    if (a.engagement?.kinds.includes('fight')) return;
    const t = ev.target ? actorById(state, ev.target) : undefined;
    if (t?.mind && saw(t) && t.bandId !== a.bandId) {
      stepStance(state, t, a, 'colder');
      applyMemoryOps(state, t, { add: [`${nameFor(state, t, a) ?? 'A stranger'} drew a weapon on me.`], drop: [] });
    }
    if (inSettlement(state, a)) for (const g of state.actors) if (isGuard(g) && g.mind && g.bandId !== a.bandId && saw(g)) raiseAlarm(state, g);
    logCode(state, 'steel_drawn_at', { actorId: a.id, ...(t ? { target: t.id } : {}) });
    return;
  }
  const offers = (state.offers ??= { pending: [], truces: {} });
  for (const x of allActors(state)) {
    if (!saw(x) || !['hostile', 'opposed'].includes(stance(state, x, a)) || !(x.kind === 'player' || x.mind?.control === 'agent')) continue;
    offers.pending.push({ from: a.id, to: x.id, landed: 'tempted', turn: state.turn, heard: [], sheathed: true });
    logCode(state, 'offer_made', { from: a.id, to: x.id, type: 'sheathe' });
  }
}
