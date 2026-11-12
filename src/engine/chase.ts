// Chases and free roam (SC16–SC19, SC23, SD2 a; CH1–CH7). A scenario has ground (CH1); leaving it with no one chasing ends the
// scenario as left and free roam starts: no scenario runs until something starts one (CH2) or an unbuilt frontier is crossed
// (CH3 a, in the director). A pursuer (CH4) is an active NPC hunting the player that has not broken or yielded; code-run
// pursuers keep to their chase range (CH5), and follow through a frontier only with range far (CH6). When no pursuer has
// seen or heard the player for CHASE_LOST_TURNS turns, the chase is lost (CH7): they drop to tracking, go back to their
// routines and remember it (the price comes from the fiction, SC23), and off the ground the scenario ends as escaped.
import type { Actor, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { CHASE_RANGES, type ChaseRange } from '../scales';
import { getLibrary } from '../library';
import { atLeast, bandById, chaseLost, hostile, isActive, zoneById } from './relations';
import { applyMemoryOps } from './memory';
import { logCode } from './effects';

/** CH7/SC23: what each pursuer remembers when the player got away (its grudge is the price) */
export const CHASE_LOST_MEMORY = 'The player fled from me and got away.';

export { chaseLost };

/** CH4: active, hunting the player (or engaged with it), not broken, surrendered or yielded, and not a chase it already lost */
export function isPursuer(state: GameState, a: Actor): boolean {
  const b = a.mind?.knowledge[state.player.id];
  return a.kind === 'npc' && isActive(a) && atLeast(b?.status, 'hunting') && !chaseLost(b) && !a.mind?.moraleState && a.mind?.overrides?.[state.player.id] !== 'yielded';
}
export const pursuers = (state: GameState): Actor[] => state.actors.filter((a) => isPursuer(state, a));

/** CH1: the running scenario's ground (none: no scenario, or a scenario from before ground was kept) */
export const groundOf = (state: GameState): string[] | undefined => state.stage.scenario?.ground;
/** BG-43: the places a ground touches; every zone of those places is on the ground (a tavern scenario's ground is the whole
 * tavern: back yard, cellar and upstairs too) */
const groundPlaces = (state: GameState, ground: string[]) => new Set(ground.map((z) => zoneById(state, z)?.placeId).filter((p): p is string => !!p));
/** is zone `z` on this ground: one of its zones, or any zone of a place it touches (BG-43) */
export function onGround(state: GameState, ground: string[], z: string): boolean {
  return ground.includes(z) || groundPlaces(state, ground).has(zoneById(state, z)?.placeId ?? '');
}
/** off the running scenario's ground, and off the bigger scenario's too (outer) */
export function offGround(state: GameState): { off: boolean; outer: boolean } {
  const z = state.player.zone, st = state.stage;
  const off = !!st.scenario?.ground && !onGround(state, st.scenario.ground, z);
  return { off, outer: off && !!st.outer?.ground && !onGround(state, st.outer.ground, z) };
}

/** CH5: an NPC's chase range: its band's, else its template's, else CONFIG.CHASE_RANGE_DEFAULT */
export function chaseRange(state: GameState, a: Actor): ChaseRange {
  const tpl = a.core.templateId ? getLibrary().templates?.[a.core.templateId]?.chase : undefined;
  return CHASE_RANGES.keyOf(bandById(state, a.bandId)?.chase) ?? CHASE_RANGES.keyOf(tpl) ?? CHASE_RANGES.keyOf(CONFIG.CHASE_RANGE_DEFAULT) ?? 'ground';
}

/** the place an NPC belongs to: its routine's first bound zone's place, else where it stands */
function homePlace(state: GameState, a: Actor): string {
  for (const v of Object.values(a.mind?.slots ?? {})) for (const z of Array.isArray(v) ? v : [v]) {
    const p = zoneById(state, z)?.placeId;
    if (p) return p;
  }
  return a.placeId;
}
const zonesOfPlaces = (state: GameState, places: Set<string>) => state.stage.zoneIds.filter((z) => places.has(zoneById(state, z)?.placeId ?? ''));

/** CH5: the zones a code-run NPC may chase the player into; undefined = anywhere (far, an agent-run NPC, or a ground or
 * near range with no ground kept for the scenario). Post: its own place. Ground: the scenario's ground (and its own place).
 * Near: those and every place one link beyond the ground. */
export function chaseZones(state: GameState, a: Actor): string[] | undefined {
  if (a.mind?.control === 'agent') return undefined;
  const range = chaseRange(state, a);
  if (range === 'far') return undefined;
  const post = zonesOfPlaces(state, new Set([homePlace(state, a)]));
  if (range === 'post') return post;
  const st = state.stage, ground = [...(st.scenario?.ground ?? []), ...(st.outer?.ground ?? [])];
  if (!st.scenario?.ground) return undefined;
  const places = groundPlaces(state, ground); // BG-43: the ground is every zone of the places it touches
  const inGround = new Set([...post, ...zonesOfPlaces(state, places)]);
  if (range === 'ground') return [...inGround];
  const beyond = new Set<string>();
  for (const z of inGround) for (const l of zoneById(state, z)?.links ?? []) {
    const p = l.frontier ? undefined : zoneById(state, l.to)?.placeId;
    if (p && !places.has(p)) beyond.add(p);
  }
  return [...new Set([...inGround, ...zonesOfPlaces(state, beyond)])];
}

/** CH6: an agent-run pursuer may follow the player through a frontier (it decides for itself); a code-run one only at range far */
const mayCross = (state: GameState, a: Actor): boolean => a.mind?.control === 'agent' || chaseRange(state, a) === 'far';

/** CH6: after the player crosses a frontier from `from` into `to`: a pursuer that saw the crossing knows where it leads */
export function noteCrossing(state: GameState, from: string, to: string): void {
  const ps = pursuers(state), p = state.player;
  if (!ps.length) return;
  (state.stage.crossings ??= []).push({ from, to, turn: state.turn });
  const ev = state.events.filter((e) => e.turn === state.turn && e.actorId === p.id && e.effects.some((x) => x.kind === 'frontier_crossed')).at(-1);
  for (const a of ps) if (ev?.perception[a.id] && mayCross(state, a)) a.mind!.knowledge[p.id]!.lastKnownZone = to;
  logCode(state, 'chase_crossing', { from, to, followers: ps.filter((a) => a.mind!.knowledge[p.id]!.lastKnownZone === to).map((a) => a.id) });
}

/**
 * Each turn, before the scenario's endings are checked. CH6: a pursuer still hunting that reaches the zone the player crossed a
 * frontier from crosses after it. CH7: when no pursuer has seen or heard the player for CHASE_LOST_TURNS turns, the chase is
 * lost: each drops to tracking, goes back to its routine and keeps a memory line; off the ground the scenario ends as escaped.
 */
export function updateChase(state: GameState): void {
  const st = state.stage, p = state.player;
  const ps = pursuers(state);
  if (!ps.length) { delete st.crossings; return; }
  for (const c of st.crossings ?? []) for (const a of ps) {
    const b = a.mind!.knowledge[p.id]!;
    if (a.zone === c.from && b.lastKnownZone === c.from && mayCross(state, a)) b.lastKnownZone = c.to;
  }
  const last = Math.max(...ps.map((a) => a.mind!.knowledge[p.id]!.lastSeenTurn ?? state.turn));
  if (state.turn - last < CONFIG.CHASE_LOST_TURNS) return;
  for (const a of ps) {
    const b = a.mind!.knowledge[p.id]!;
    b.status = 'tracking';
    b.lostTurn = state.turn;
    applyMemoryOps(state, a, { add: [CHASE_LOST_MEMORY], drop: [] });
  }
  delete st.crossings;
  const g = offGround(state);
  logCode(state, 'chase_lost', { pursuers: ps.map((a) => a.id), offGround: g.off });
  if (st.scenario && g.off && !st.ending) st.ending = { as: 'escaped', text: '', turn: state.turn, roam: true, ...(g.outer ? { outer: true as const } : {}) };
}

/** SC16: off the ground with no one chasing: the scenario ends as left (the bigger scenario too when off its ground), and free roam
 * starts. With someone chasing, the scenario follows the chase (CH4) and CH7 decides. */
export function checkGround(state: GameState): void {
  const st = state.stage;
  if (!st.scenario || st.ending || st.breakCause) return;
  const g = offGround(state);
  if (!g.off || pursuers(state).length) return;
  st.ending = { as: 'left', text: '', turn: state.turn, roam: true, ...(g.outer ? { outer: true as const } : {}) };
  logCode(state, 'scenario_ground_left', { zone: state.player.zone, outer: g.outer });
}

/** CH2: what starts a new scenario in free roam, from this turn: talk, trade or a fight with the player, someone hostile spotting
 * the player, or a quest goal reached (reach, find, deliver). Road encounters and unbuilt frontiers start one on their own. */
export function roamStart(state: GameState, events: GameEvent[]): string | null {
  const p = state.player;
  for (const e of events) {
    if (e.bark) continue;
    if (e.kind === 'speak' && ((e.actorId === p.id && (!!e.target || !!e.speech?.addressees.length)) || (e.target === p.id && e.actorId !== p.id))) return 'talk';
    if (['buy', 'sell', 'buy_refused', 'sell_refused'].includes(e.kind) && (e.actorId === p.id || e.target === p.id)) return 'trade';
    if (e.kind === 'attack' && (e.actorId === p.id || e.target === p.id)) return 'attack';
  }
  const spotted = state.actors.some((a) => {
    const b = a.mind?.knowledge[p.id];
    return isActive(a) && hostile(state, a, p) && atLeast(b?.status, 'aware') && b?.lastSeenTurn === state.turn;
  });
  if (spotted) return 'spotted';
  const ready = state.log.filter((l) => l.turn === state.turn && l.code === 'quest_ready').map((l) => state.quests.find((q) => q.id === l.detail?.id));
  if (ready.some((q) => q && ['reach', 'find', 'deliver'].includes(q.goal.kind))) return 'quest';
  return null;
}

/** SD2 a: in free roam (from a turn before this one), the first thing that happens starts a new scenario after this turn */
export function checkRoam(state: GameState, events: GameEvent[]): void {
  const st = state.stage;
  if (!st.roam || st.roam.since >= state.turn || st.scenario || st.breakCause) return;
  const why = roamStart(state, events);
  if (!why) return;
  st.breakCause = 'roam';
  logCode(state, 'roam_scenario', { why });
}

