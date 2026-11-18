// Tricks seen through (WN2, WN3, WN8, WN11): who knows whose trick, and the warnings still to give. The warning itself is
// engine/warnings.ts. A trick known is a revealed fact 'ruse:<trick>' on an NPC's belief about the trickster (the
// player keeps journal.ruses), kept for good, so it is passed on by any line like concealed gear once seen.
import type { Actor, GameState, TierShift } from '../types';
import { CONFIG } from '../config';
import { updateBeliefs } from '../perception';

/** the tricks a foe can see through and pass on (stable keys; the fact is 'ruse:<key>') */
export const TRICK = { play_dead: 'play_dead', feint: 'feint', bluff: 'bluff', draw_them_in: 'draw_them_in' } as const;
export type Trick = (typeof TRICK)[keyof typeof TRICK];
/** WN4/WN8: what a warning about someone hidden is queued as */
export const HIDDEN = 'hidden';
export const RUSE = 'ruse:';
export const isTrick = (t: string): t is Trick => (Object.values(TRICK) as string[]).includes(t);

/** x knows owner's trick (saw through it, or was warned of it) */
export function knowsTrick(x: Actor, ownerId: string, t: Trick): boolean {
  if (x.kind === 'player') return !!x.journal?.ruses?.[ownerId]?.includes(t);
  return !!x.mind?.knowledge[ownerId]?.revealed?.includes(RUSE + t);
}
/** WN3/WN11: the shift on x's answer to owner's trick */
export const warnedShift = (x: Actor, ownerId: string, t: Trick): TierShift[] =>
  knowsTrick(x, ownerId, t) ? [{ source: 'Knows the trick', value: CONFIG.WARNED_SHIFT }] : [];

/** the tricks x knows of owner */
export const tricksKnown = (x: Actor, ownerId: string): Trick[] => (Object.values(TRICK) as Trick[]).filter((t) => knowsTrick(x, ownerId, t));

/** x learns owner's trick; true when it is new to x */
export function learn(state: GameState, x: Actor, ownerId: string, t: Trick): boolean {
  if (knowsTrick(x, ownerId, t)) return false;
  if (x.kind === 'player') { const r = ((x.journal ??= {} as NonNullable<Actor['journal']>).ruses ??= {}); r[ownerId] = [...(r[ownerId] ?? []), t]; }
  else updateBeliefs(state, { kind: 'reveal', observerId: x.id, aboutId: ownerId, fact: RUSE + t });
  return true;
}

/** WN11 a + WN8 a: x saw through owner's trick with its own eyes: it knows it from now on, and may warn its allies */
export function sawThrough(state: GameState, x: Actor, owner: Actor, t: Trick, own = true): void {
  learn(state, x, owner.id, t);
  if (own) queueWarn(x, owner.id, t); // a second look after a warning is not news of its own (never on hearsay)
}
/** WN8 a: x spotted the hidden `h` itself (won a stealth contest or a search): it may warn its allies */
export function spotted(x: Actor, h: Actor): void {
  queueWarn(x, h.id, HIDDEN);
}
function queueWarn(x: Actor, about: string, what: string): void {
  if (!x.mind) return;
  const q = (x.mind.toWarn ??= []);
  if (!q.some((w) => w.about === about && w.trick === what)) q.push({ about, trick: what });
}

/** WN2/WN3: a ruse fact that reached x some other way (a line it heard) was new to it: it rolls again at turn end */
export function queueLearned(state: GameState, xId: string, ownerId: string, fact: string): void {
  const t = fact.startsWith(RUSE) ? fact.slice(RUSE.length) : '';
  if (!isTrick(t)) return;
  const q = ((state.scratch ??= {}).rusesLearned ??= []) as { x: string; owner: string; t: Trick }[];
  if (!q.some((e) => e.x === xId && e.owner === ownerId && e.t === t)) q.push({ x: xId, owner: ownerId, t });
}


/** WN4 b: the shift on x's next notice or search roll at the hidden h, spent by that roll */
export function pointedShift(state: GameState, x: Actor, h: Actor): TierShift[] {
  const m = x.kind === 'player' ? x.journal?.pointed : x.mind?.pointed;
  const at = m?.[h.id];
  if (at === undefined) return [];
  delete m![h.id];
  return state.turn - at <= CONFIG.POINTED_TURNS ? [{ source: 'Pointed out', value: CONFIG.POINTED_SHIFT }] : [];
}
