// Sparring (SP1–SP11): a spar is a pact between sides that lets them hit each other while nobody's stance changes.
// It starts in talk (an NPC records it, like a deal) or in the Weaver's stage plan. A fighter is out once it yields or
// reaches the spar's limit on the health track; the last side with anyone left in wins. Blows do their normal damage.
// The spar ends early on a scenario break, after ENGAGEMENT_END (engagementEndS) with no blow between sides, or when anyone
// outside it attacks a fighter, or a fighter attacks anyone outside it (that attack is a real one).
import type { Actor, GameEvent, GameState, Spar } from '../types';
import { CONFIG } from '../config';
import { healthLevel } from '../ruleset/body';
import { actorById, isActive } from './relations';
import { logCode } from './effects';
import { tally } from './xp';
import { HEALTH_LEVELS, type HealthLevelKey } from '../scales';
import { secondsSince } from '../time';
import { engagementEndS } from '../ruleset/actionTime';

/** SP4: the health level that puts a fighter out: SPAR_LIMIT, or Incapacitated in a cruel spar (both fighters accepted it) */
export const sparLimit = (sp: Spar): HealthLevelKey => (sp.cruel ? 'incapacitated' : CONFIG.SPAR_LIMIT);
/** the live spar an actor is a fighter in */
export const sparOf = (state: GameState, id: string): Spar | undefined => state.spars?.find((sp) => sp.sides.some((s) => s.includes(id)));

/** SP2/SP3: a new spar. Every fighter is a different active actor, there are two sides or more, none is empty, and no
 * fighter is already in a spar. Returns the spar's id, or undefined (logged) when the request breaks a rule. */
export function startSpar(state: GameState, sides: string[][], cruel: boolean, by: string): string | undefined {
  const ids = sides.flat();
  const bad = sides.length < 2 || sides.some((s) => !s.length) || new Set(ids).size !== ids.length
    || ids.some((id) => { const a = actorById(state, id); return !a || !isActive(a) || !!sparOf(state, id); });
  if (bad) { logCode(state, 'invalid_spar', { by, sides }); return undefined; }
  const list = (state.spars ??= []);
  let id = `spar_${state.turn}_${by}`;
  for (let i = 2; list.some((x) => x.id === id); i++) id = `spar_${state.turn}_${by}_${i}`;
  list.push({ id, sides: sides.map((s) => [...s]), ...(cruel ? { cruel: true as const } : {}), start: state.turn, last: state.turn, out: {} });
  logCode(state, 'spar_started', { id, sides, cruel, by });
  return id;
}

/** SP5: a fighter gives up. Returns false when it is in no spar, or already out. */
export function yieldSpar(state: GameState, a: Actor): boolean {
  const sp = sparOf(state, a.id);
  if (!sp || a.id in sp.out) { logCode(state, 'invalid_spar_yield', { actorId: a.id }); return false; }
  sp.out[a.id] = state.turn;
  logCode(state, 'spar_out', { id: sp.id, actorId: a.id, reason: 'yielded' });
  return true;
}

/** SP4: fighters at or past the limit (or no longer active, or gone) are out */
export function checkOut(state: GameState, sp: Spar): void {
  for (const id of sp.sides.flat()) {
    if (id in sp.out) continue;
    const a = actorById(state, id);
    if (a && isActive(a) && HEALTH_LEVELS.pos(healthLevel(a)) < HEALTH_LEVELS.pos(sparLimit(sp))) continue;
    sp.out[id] = state.turn;
    logCode(state, 'spar_out', { id: sp.id, actorId: id, reason: 'limit' });
  }
}

function endSpar(state: GameState, sp: Spar, cause: 'won' | 'scenario_break' | 'quiet' | 'outside_attack', winners: string[] = []): void {
  state.spars = state.spars!.filter((x) => x !== sp);
  if (!state.spars.length) delete state.spars;
  logCode(state, 'spar_ended', { id: sp.id, cause, winners });
  if (winners.includes(state.player.id)) {
    tally(state, 'spar_wins'); // SP8: no defeat XP; SP9: counted for spar achievements
    if (sp.cruel) tally(state, 'cruel_spar_wins');
  } else if (cause === 'won' && sp.sides.some((s) => s.includes(state.player.id))) tally(state, 'spar_losses'); // a scar chain
}

/** a blow between two fighters of one spar where either went out of it this turn: the order was made before, so the
 * blow is held back. From the next turn on, a blow on or by a fighter who is out is a real attack (SP7). */
export const heldBack = (state: GameState, a: Actor, t: Actor): boolean => {
  const sp = sparOf(state, t.id);
  return !!sp && sp.sides.some((s) => s.includes(a.id)) && (sp.out[t.id] === state.turn || sp.out[a.id] === state.turn);
};

/** SP7: an attack between a fighter and anyone outside its spar ends that spar */
export function endSparsOf(state: GameState, ids: string[]): void {
  for (const sp of [...(state.spars ?? [])]) if (sp.sides.some((s) => s.some((id) => ids.includes(id)))) endSpar(state, sp, 'outside_attack');
}

/** after each turn: blows keep a spar alive; the last side with a fighter still in wins; a scenario break or quiet ends it */
export function updateSpars(state: GameState, events: GameEvent[]): void {
  for (const sp of [...(state.spars ?? [])]) {
    const ids = sp.sides.flat();
    if (events.some((e) => e.spar && ids.includes(e.actorId))) sp.last = state.turn;
    checkOut(state, sp);
    const left = sp.sides.filter((s) => s.some((id) => !(id in sp.out)));
    if (left.length <= 1) endSpar(state, sp, 'won', left[0] ?? []);
    else if (state.stage.breakCause) endSpar(state, sp, 'scenario_break');
    else if (secondsSince(state, sp.last) >= engagementEndS()) endSpar(state, sp, 'quiet');
  }
}
