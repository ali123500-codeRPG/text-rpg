// Chases and free roam (SC16–SC19, SC23, SD2 a; CH1–CH7). A scenario has ground (CH1); leaving it with no one chasing ends the
// scenario as left and free roam starts: no scenario runs until danger starts one or a scenario window
// opens (WB5, WB6); crossing an unbuilt frontier only builds ground. A pursuer (CH4) is an active NPC hunting the player that has not broken or yielded; code-run
// pursuers keep to their chase range (CH5), and follow through a frontier only with range far (CH6). When no pursuer has
// seen or heard the player for CHASE_LOST_S seconds, the chase is lost (CH7): they drop to tracking, go back to their
// routines and remember it (the price comes from the fiction, SC23), and off the ground the scenario ends as escaped.
import type { Actor, GameEvent, GameState, WindowAnswer } from '../types';
import { CONFIG } from '../config';
import { CHASE_RANGES, type ChaseRange } from '../scales';
import { getLibrary } from '../library';
import { atLeast, bandById, chaseLost, hostile, isActive, shortestPath, zoneById } from './relations';
import { pathM, wayPoint, type Located } from './position';
import { applyMemoryOps } from './memory';
import { logCode } from './effects';
import { now, secondsSince } from '../time';

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

/** ZR12: metres from `at` back to the ground (`inGround`, every zone of its places) by the walking path: 0 on it, else the
 * walk to the nearest way into it. Without a point, from where its zone is left toward the ground. Infinity: no way back. */
function metresToGround(state: GameState, at: { zone: string; pos?: Located['pos'] }, inGround: Set<string>): number {
  if (inGround.has(at.zone)) return 0;
  let best = Infinity;
  const edges = [...inGround].filter((g) => zoneById(state, g)?.links.some((l) => !inGround.has(l.to)));
  for (const g of edges) {
    const p = shortestPath(state, at.zone, g);
    if (!p || p.some((z) => z !== g && inGround.has(z))) continue; // only the ways into the ground from outside it
    const prev = p.length > 1 ? p[p.length - 2] : at.zone, from = { zone: at.zone, pos: at.pos ?? wayPoint(state, at.zone, p[0], at) ?? undefined };
    const edge = wayPoint(state, prev, g, from);
    if (edge) best = Math.min(best, pathM(state, from, { zone: prev, pos: edge }, p.slice(0, -1)));
  }
  return best;
}

/** the ground a code-run NPC chases on: its own place's zones, and with range ground or near the scenario's ground (every
 * zone of the places it touches, BG-43); undefined = no limit (far, an agent-run NPC, or no ground kept for the scenario) */
function chaseGround(state: GameState, a: Actor): Set<string> | undefined {
  if (a.mind?.control === 'agent') return undefined;
  const range = chaseRange(state, a);
  if (range === 'far') return undefined;
  const post = zonesOfPlaces(state, new Set([homePlace(state, a)]));
  if (range === 'post') return new Set(post);
  const st = state.stage;
  if (!st.scenario?.ground) return undefined;
  const ground = [...st.scenario.ground, ...(st.outer?.ground ?? [])];
  return new Set([...post, ...zonesOfPlaces(state, groundPlaces(state, ground))]);
}

/** CH5: the zones a code-run NPC may chase the player into; undefined = anywhere (far, an agent-run NPC, or a ground or
 * near range with no ground kept for the scenario). Post: its own place. Ground: the scenario's ground (and its own place).
 * Near (ZR12): those and every zone that starts within CHASE_NEAR_M metres past the ground's edge by the walking path. */
export function chaseZones(state: GameState, a: Actor): string[] | undefined {
  const inGround = chaseGround(state, a);
  if (!inGround || chaseRange(state, a) !== 'near') return inGround && [...inGround];
  return state.stage.zoneIds.filter((z) => metresToGround(state, { zone: z }, inGround) <= CONFIG.CHASE_NEAR_M);
}

/** ZR12: a code-run pursuer with range near that stands CHASE_NEAR_M or more past the ground's edge turns back there, even
 * partway down a long road */
export function atChaseLine(state: GameState, a: Actor): boolean {
  const inGround = chaseGround(state, a);
  return !!inGround && chaseRange(state, a) === 'near' && metresToGround(state, a, inGround) >= CONFIG.CHASE_NEAR_M;
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
 * frontier from crosses after it. CH7: when no pursuer has seen or heard the player for CHASE_LOST_S seconds, the chase is
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
  if (secondsSince(state, last) < CONFIG.CHASE_LOST_S) return;
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

/** WB5: what starts a scenario at once in free roam, from this turn: a fight with the player, or someone hostile spotting them.
 * Road encounters start one on their own. Talk, trade and crossing a frontier start nothing by themselves. */
export function roamStart(state: GameState, events: GameEvent[]): string | null {
  const p = state.player;
  if (events.some((e) => e.kind === 'attack' && (e.actorId === p.id || e.target === p.id))) return 'attack';
  const spotted = state.actors.some((a) => {
    const b = a.mind?.knowledge[p.id];
    return isActive(a) && hostile(state, a, p) && atLeast(b?.status, 'aware') && b?.lastSeenTurn === state.turn;
  });
  return spotted ? 'spotted' : null;
}

/** WB6/WB7: what opens a scenario window in free roam this turn. The player's own acts (a job taken or a deal made with them,
 * a job's goal reached) open one at any time; past the rest after the last scenario, so do an active job left untouched for
 * THREAD_STALE_MIN (stale) and a quiet stretch of ROAM_QUIET_MIN (quiet), but not within WINDOW_DECLINED_MIN of a declined one. */
export function roamWindow(state: GameState): string | null {
  const r = state.stage.roam!, p = state.player.id, t = now(state), mine = state.log.filter((l) => l.turn === state.turn);
  if (mine.some((l) => l.code === 'quest_made' || (l.code === 'agreement_made' && (l.detail?.parties as string[] | undefined)?.includes(p)))) return 'job';
  if (mine.some((l) => l.code === 'quest_ready')) return 'quest';
  const since = r.sinceMin ?? t, calm = Math.max(since + (r.rest ?? 0), r.declinedAt === undefined ? -Infinity : r.declinedAt + CONFIG.WINDOW_DECLINED_MIN);
  if (t < calm) return null;
  if (state.quests.some((q) => q.state === 'active' && t - (q.startAt ?? since) >= CONFIG.THREAD_STALE_MIN)) return 'stale';
  return t - calm >= CONFIG.ROAM_QUIET_MIN ? 'quiet' : null;
}

/** SD2 a / WB5-WB7: in free roam (from a turn before this one), danger starts a scenario after this turn; anything else that
 * matters opens a scenario window, which the Weaver is asked about after the save (it may decline). SW3 a: either way the
 * Weaver is told why, what happened in the roam, and who saw the player this turn. */
export function checkRoam(state: GameState, events: GameEvent[]): void {
  const st = state.stage;
  if (!st.roam || st.roam.since >= state.turn || st.scenario || st.breakCause) return;
  const danger = roamStart(state, events), why = danger ?? (st.window ? null : roamWindow(state));
  if (!why) return;
  const seenBy = state.actors.filter((a) => a !== state.player && isActive(a) && a.mind?.knowledge[state.player.id]?.lastSeenTurn === state.turn).map((a) => a.id);
  st.cause = { why, happened: [...(st.roam.happened ?? [])], seenBy };
  if (danger) { delete st.window; st.breakCause = 'roam'; logCode(state, 'roam_scenario', { why }); return; }
  st.window = 'due';
  logCode(state, 'window_opened', { why });
}

/** WB6: the Weaver's answer to the window, back from its background call: start the scenario now (null, a failed call, starts
 * one too, as before windows) or not now. Nothing happens if a scenario started meanwhile or free roam ended. */
export function applyWindow(state: GameState, answer: WindowAnswer | null): void {
  const st = state.stage, open = st.window;
  delete st.window;
  if (!open || !st.roam || st.scenario || st.breakCause || !st.cause) return;
  if (answer && !answer.start) {
    st.roam.declinedAt = now(state);
    logCode(state, 'window_declined', { why: st.cause.why, ...(answer.note ? { note: answer.note } : {}) });
    delete st.cause;
    return;
  }
  st.breakCause = 'roam';
  logCode(state, answer ? 'roam_scenario' : 'window_failed', { why: st.cause.why });
}

