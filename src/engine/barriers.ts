// SD3–SD5, BA3–BA7: barriers on ways (doors, gates, grates, hatches, rubble). One record per barrier, in
// GameState.barriers; the links on both sides of the way name it by id. A shut barrier stops walking: a key opens a lock
// (BA3), the bolt's side draws a bar back (BA4), each in a move slot; rubble opens only by clearing it. Breaking any of
// them (wear, material, thickness) belongs to the walls thread: a Destroyed barrier is open to all, a Crippled one lets an
// amorphous body through (BA7). Guarded is a tag only (BA6).
import type { Actor, Barrier, GameState, ZoneLink } from '../types';
import { getLibrary } from '../library';
import { BT } from '../library/raceIds';

export const barrierOn = (state: GameState, l: ZoneLink | undefined): Barrier | undefined => (l?.barrier ? state.barriers?.[l.barrier] : undefined);
export const barrierName = (b: Barrier): string => getLibrary().barrierKinds?.[b.kind]?.name.toLowerCase() ?? 'barrier';

/** broken through (the walls thread's wear): open to everyone */
const broken = (b: Barrier) => b.state === 'destroyed';
/** BA7: a barrier broken to Crippled lets an amorphous body through */
const squeezes = (b: Barrier, a: Actor) => b.state === 'crippled' && a.core.bodyTypeId === BT.amorphous;

/** BF12: a grip passes this way (handing something over, reaching through): it is open, or shut but you can see through it (bars, a grate); a shut door, gate or hatch
 * passes nothing */
export const gripPasses = (b: Barrier | undefined): boolean => !b || !isShut(b) || !!getLibrary().barrierKinds?.[b.kind]?.seeThrough;
/** shut to someone with no key on the wrong side of the bar: locked, barred or blocked, and not broken through */
export const isShut = (b: Barrier): boolean => !broken(b) && !b.open && (!!b.blocked || !!b.lock?.locked || !!b.bar?.drawn);
/** BA3: `a` carries a key naming this barrier */
export const holdsKey = (a: Actor, b: Barrier): boolean => a.core.inventory.some((i) => i.opens?.includes(b.id));
/** BA4: `from` is the bolt's side */
export const boltSide = (b: Barrier, from: string): boolean => b.bar?.side === from;

export type Passage = 'open' | 'opens' | 'shut';
/** how `a`, standing in `from`, gets through: 'open' (nothing in the way), 'opens' (its key turns the lock, it is on the
 * bolt's side: a move slot), or 'shut'. With no one named, only an open barrier passes. */
export function passage(b: Barrier, a: Actor | undefined, from: string): Passage {
  if (!isShut(b) || (a && squeezes(b, a))) return 'open';
  if (!a || b.blocked) return 'shut';
  const lockOk = !b.lock?.locked || holdsKey(a, b);
  const barOk = !b.bar?.drawn || boltSide(b, from);
  return lockOk && barOk ? 'opens' : 'shut';
}
/** the passage of link `l` out of `from` for `a` ('open' when it has no barrier) */
export const linkPassage = (state: GameState, l: ZoneLink, a: Actor | undefined, from: string): Passage => {
  const b = barrierOn(state, l);
  return b ? passage(b, a, from) : 'open';
};

/** what `a` opens on its way through from `from`: the key turns, the bar slides back (each in the one move slot) */
export function openWay(b: Barrier, a: Actor, from: string): ('unlocked' | 'unbarred')[] {
  const did: ('unlocked' | 'unbarred')[] = [];
  if (b.lock?.locked && holdsKey(a, b)) { b.lock.locked = false; did.push('unlocked'); }
  if (b.bar?.drawn && boltSide(b, from)) { b.bar.drawn = false; did.push('unbarred'); }
  return did;
}

/** why a barrier stops someone who tried it: the first of blocked, barred (from the far side), locked */
export function shutBy(b: Barrier, from: string): 'blocked' | 'barred' | 'locked' {
  if (b.blocked) return 'blocked';
  if (b.bar?.drawn && !boltSide(b, from)) return 'barred';
  return 'locked';
}

/** someone who tried the barrier and found it shut knows it is locked or barred */
export function noteTried(b: Barrier, a: Actor): void {
  if (!(b.tried ??= []).includes(a.id)) b.tried.push(a.id);
}

export type WayOp = 'lock' | 'unlock' | 'bar' | 'unbar' | 'open' | 'shut';
/** BA3/BA4: a deliberate turn of the key or slide of the bar, in a move slot: the reason it can't be done, or null when done.
 * BG-70: opening it to stand open (its key turns and the bar on this side slides back with it) or shutting it again; a
 * way shut to `a` returns 'shut' (the caller lets them try it) */
export function wayOp(b: Barrier, a: Actor, from: string, op: WayOp): string | null {
  if (op === 'open') {
    if (b.open || broken(b)) return 'already';
    if (passage(b, a, from) === 'shut') return 'shut';
    openWay(b, a, from);
    b.open = true;
    return null;
  }
  if (op === 'shut') {
    if (!b.open) return 'already';
    delete b.open;
    return null;
  }
  if (b.open) return 'open';
  if (op === 'lock' || op === 'unlock') {
    if (!b.lock) return 'no_lock';
    if (!holdsKey(a, b)) return 'no_key';
    if (b.lock.locked === (op === 'lock')) return 'already';
    b.lock.locked = op === 'lock';
    return null;
  }
  if (!b.bar) return 'no_bar';
  if (!boltSide(b, from)) return 'far_side';
  if (b.bar.drawn === (op === 'bar')) return 'already';
  b.bar.drawn = op === 'bar';
  return null;
}

/** what `viewer` standing in `from` can tell of a barrier: its kind; that it is blocked or broken (plain to see); a drawn bar
 * from the bolt's side; and a lock or a bar from the far side only once they tried it, or hold its key */
export function barrierView(b: Barrier, viewer: Actor | undefined, from: string): { kind: string; open?: true; blocked?: true; locked?: true; barred?: true; key?: true; broken?: string } {
  const knows = !viewer || b.tried?.includes(viewer.id) || false;
  const key = !!viewer && holdsKey(viewer, b);
  return {
    kind: barrierName(b),
    ...(b.open ? { open: true as const } : {}),
    ...(b.blocked && !broken(b) ? { blocked: true as const } : {}),
    ...(b.lock?.locked && (knows || key) ? { locked: true as const } : {}),
    ...(b.bar?.drawn && (knows || boltSide(b, from)) ? { barred: true as const } : {}),
    ...(key ? { key: true as const } : {}),
    ...(b.state && b.state !== 'healthy' ? { broken: b.state } : {}),
  };
}
