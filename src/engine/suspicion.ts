// GD1-GD6 (BF29): guards and locked containers. A guard (class Guard) whose search turns up a locked container on someone
// (GD2 b: only a search, not a look; on sight is parked, D-306) suspects them until they prove it holds nothing it is after
// (GD3 b): it holds the suspicion (shown to its agent; a code-run guard keeps close and asks to see inside) and is one step
// colder to them. What a guard is after (GD1 b): stolen goods (ItemInstance.stolenFrom) and the scenario's forbidden goods
// (StageInfo.forbidden, set by the Weaver); what it was told about lives in its memory for its agent to weigh. Cleared
// (GD4 b) when the container is opened where the guard clearly sees inside: nothing it is after, the suspicion goes and the
// step comes back; something it is after, caught, as caught Filching for the item (FL5); or when the suspect wins a
// Persuasion or Lying contest against the guard. It lasts until cleared or the scenario ends (GD5 a), and anyone can be
// suspected, NPCs too (GD6 a).
import type { Actor, ActorView, GameEvent, GameState, ItemInstance, Order } from '../types';
import { CL } from '../library/classIds';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { allActors, actorById, isActive, isAsleep, nameFor } from './relations';
import { stepStance, logCode } from './effects';
import { applyMemoryOps } from './memory';
import { filchAftermath } from './filch';
import { carriedContents, isContainer } from './containers';
import { perceptionOf } from '../perception';

export const isGuard = (a: Actor): boolean => a.core.classes.some((c) => c.classId === CL.guard);

/** GD1 b: is this something the guard is after: stolen, or forbidden in this scenario */
export const sought = (state: GameState, i: ItemInstance): boolean => !!i.stolenFrom || !!state.stage.forbidden?.includes(i.itemId);

/** GD2/GD3: a guard's search found `box`, a locked container `t` carries: it suspects them, one step colder, and remembers */
export function suspect(state: GameState, guard: Actor, t: Actor, box: ItemInstance): void {
  if (!guard.mind || guard === t || !isGuard(guard) || guard.bandId === t.bandId) return;
  const s = (guard.mind.suspects ??= {});
  if (s[t.id]) return;
  s[t.id] = { box: box.id, turn: state.turn };
  stepStance(state, guard, t, 'colder');
  applyMemoryOps(state, guard, { add: [`I suspect ${nameFor(state, guard, t) ?? 'a stranger'}: they carry a locked ${itemDef(state, box.itemId).name} and have not shown me inside.`], drop: [] });
  logCode(state, 'suspected', { actorId: guard.id, of: t.id, box: box.id });
}

/** GD4: end a guard's suspicion of `t`, giving the step back when it was cleared rather than caught */
function clear(state: GameState, guard: Actor, t: Actor, why: 'shown' | 'talked' | 'caught'): void {
  delete guard.mind!.suspects![t.id];
  if (why !== 'caught') stepStance(state, guard, t, 'friendlier');
  const who = nameFor(state, guard, t) ?? 'the stranger';
  if (why !== 'caught') applyMemoryOps(state, guard, { add: [why === 'shown' ? `${who} showed me inside; nothing I was after.` : `${who} talked me out of my suspicion.`], drop: [] });
  logCode(state, 'suspicion_cleared', { actorId: guard.id, of: t.id, why });
}

/** GD4 a: `box` stands open (opened, picked or broken by `ev`): every guard that suspects someone over it and made the act
 * out clearly sees inside. Nothing it is after: cleared. Something: caught, as caught Filching for that item. */
export function shownInside(state: GameState, box: ItemInstance, ev: GameEvent): void {
  if (!box.open || box.lock?.locked) return;
  const inside = [...(box.contents ?? []), ...carriedContents(state, box.contents ?? []).map((x) => x.inst)];
  for (const g of allActors(state)) {
    const hit = g.mind?.suspects && Object.entries(g.mind.suspects).find(([, s]) => s.box === box.id);
    if (!hit || !isActive(g) || isAsleep(g)) continue;
    const t = actorById(state, hit[0]);
    if (!t) { delete g.mind!.suspects![hit[0]]; continue; }
    if ((ev.perception[g.id]?.level ?? perceptionOf(ev, state, g)?.level) !== 'full') continue;
    const found = inside.find((i) => sought(state, i));
    if (!found) { clear(state, g, t, 'shown'); continue; }
    clear(state, g, t, 'caught');
    const what = itemDef(state, found.itemId).name;
    if (found.stolenFrom) filchAftermath(state, t, actorById(state, found.stolenFrom), what, { outcome: 'caught', caught: [g], suspicious: [] });
    else { // forbidden goods: caught with them, the same steps as a thief caught by a witness
      for (let n = 0; n < CONFIG.FILCH_CAUGHT_WITNESS_STEPS; n++) stepStance(state, g, t, 'colder');
      applyMemoryOps(state, g, { add: [`I caught ${nameFor(state, g, t) ?? 'a stranger'} with forbidden goods: a ${what}.`], drop: [] });
    }
  }
}

/** GD4 b: `t` won a Persuasion or Lying contest against `guard`: a suspicion it held of them is dropped */
export function talkedPast(state: GameState, guard: Actor | undefined, t: Actor): void {
  if (guard?.mind?.suspects?.[t.id]) clear(state, guard, t, 'talked');
}

/** GD5 a: suspicions last until the scenario ends */
export function endSuspicions(state: GameState): void {
  for (const a of allActors(state)) if (a.mind?.suspects) delete a.mind.suspects;
}

/** GD2: the locked containers among what a search found */
export const lockedBoxes = (state: GameState, found: ItemInstance[]): ItemInstance[] => found.filter((i) => isContainer(state, i) && !!i.lock?.locked);

/** GD3: a code-run guard's turn while it suspects someone it can see: it keeps close to them and, every
 * SUSPECT_ASK_TURNS turns, asks them to open the container. Undefined when it suspects no one in sight. */
export function suspicionOrder(state: GameState, a: Actor, v: ActorView): Order | undefined {
  const s = a.mind?.control === 'code' ? a.mind.suspects : undefined;
  const [id, sus] = Object.entries(s ?? {}).find(([who]) => v.seen.some((x) => x.id === who) && isActive(actorById(state, who) ?? a)) ?? [];
  const t = id ? actorById(state, id) : undefined;
  if (!t || !sus) return undefined;
  const near = { move: t.zone, moveSpot: { near: t.id } };
  if (sus.asked !== undefined && state.turn - sus.asked < CONFIG.SUSPECT_ASK_TURNS) return { actorId: a.id, type: 'hold', target: null, skill: null, intent: 'keeps close to someone it suspects', source: 'routine', ...near };
  sus.asked = state.turn;
  const box = (() => { try { return itemDef(state, [...t.core.inventory, ...carriedContents(state, t.core.inventory).map((x) => x.inst)].find((i) => i.id === sus.box)?.itemId ?? '').name; } catch { return 'box'; } })();
  return { actorId: a.id, type: 'talk', target: t.id, skill: null, intent: 'asks to see inside the locked container', source: 'routine', ...near,
    line: { text: `Open that ${box}. I want to see what's inside.`, volume: 'normal', to: t.id }, addressees: [t.id] };
}
