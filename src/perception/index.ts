// W3 — Perception per event, the single belief writer, communication events, belief decay.
import type { Actor, Belief, BeliefStatus, CheckResult, ContestResult, AttackResult, Cue, GameEvent, GameState, Perception, Rng } from '../types';
import { BELIEF_ORDER } from '../types';
import { CONFIG } from '../config';
import { zoneLight } from '../time';
import { actorById, allActors, atLeast, isActive, shortestPath, zoneById } from '../engine/relations';
import { getLibrary, itemDef, resolveAlias } from '../library';
import { hasPerk } from '../ruleset/perks';

export type BeliefUpdate =
  | { kind: 'event'; event: GameEvent; result?: CheckResult | ContestResult | AttackResult }
  | { kind: 'detection'; observerId: string; aboutId: string; status: BeliefStatus; event: GameEvent }
  | { kind: 'opening'; observerId: string; aboutId: string; status: BeliefStatus; zone?: string; source?: 'seen' | 'heard' | 'told' }
  | { kind: 'reveal'; observerId: string; aboutId: string; fact: string }
  | { kind: 'lost'; observerId: string; aboutId: string; zone?: string };

/** communication events copy the sender's beliefs (Information model); barks never do */
export const isComm = (e: GameEvent) =>
  !e.bark && (['call_help', 'alarm', 'report'].includes(e.kind) || (['speak', 'talk'].includes(e.kind) && !!e.line));

type Seen = { level: Perception; cue: Cue };
const better = (a: Seen | null, b: Seen | null): Seen | null => (!a ? b : !b ? a : b.level === 'full' && a.level !== 'full' ? b : a);

/** links between two zones (stage only, no frontiers); null = unreachable */
function dist(state: GameState, from: string, to: string, sightOnly: boolean): number | null {
  const p = shortestPath(state, from, to, sightOnly);
  return p ? p.length : null;
}

// GAP: the spec gives no reach table. Each NOISE / VISIBILITY level reaches [full, partial] zone links (CONFIG.NOISE_REACH,
// CONFIG.SIGHT_REACH): sight counts sight links only, sound any links. Dark zone: sight at most partial.
// Sound from another zone is always partial: you hear something, not who (test 4: a noisy move out of sight gives no name).
// The event is perceived at its own zone (a move: the destination zone).
function reach([full, partial]: [number, number], d: number | null): Perception | null {
  return d === null ? null : d <= full ? 'full' : d <= partial ? 'partial' : null;
}

/** raw perception of an event by one observer, ignoring the unaware-of-player rule (detectPlayer uses this). */
export function perceptionOf(event: GameEvent, state: GameState, observer: Actor): Seen | null {
  if (!isActive(observer)) return null;
  if (observer.id === event.actorId) return { level: 'full', cue: 'sight' };
  const zone = zoneById(state, event.zone);
  let sight: Seen | null = null;
  const sl = reach(CONFIG.SIGHT_REACH[event.visibility], dist(state, observer.zone, event.zone, true));
  if (sl) sight = { level: zoneLight(state, zone) === 'dark' ? 'partial' : sl, cue: 'sight' };
  // Q17: someone the player saw clearly stays seen while they stay put (within the zones the player can see)
  if (observer.kind === 'player' && event.kind !== 'move' && event.kind !== 'flee' && observer.journal?.clearSight?.[event.actorId] === event.zone) {
    const d = dist(state, observer.zone, event.zone, true);
    if (d !== null && d <= 1) sight = { level: 'full', cue: 'sight' };
  }
  // A14 Keen Ear: a sound reaches the owner one zone link further
  const [full, heard] = CONFIG.NOISE_REACH[event.noise];
  const nl = reach([full, heard >= 0 && hasPerk(observer, 'keen_ear') ? heard + 1 : heard], dist(state, observer.zone, event.zone, false));
  const sound: Seen | null = nl ? { level: nl, cue: 'sound' } : null;
  let best = better(sight, sound);
  // GAP: the target of an event always feels it (at least partial, touch), e.g. a missile from an unseen zone.
  if (event.target === observer.id) best = better(best, { level: 'partial', cue: 'touch' });
  return best;
}

/** Q17: the player's clear sightings. A full sight of an actor records its zone; a move the player did not see clearly forgets it.
 * NS2: a stealthy actor's move the player does not perceive at all loses it: aware drops to suspicious. */
export function noteSightings(event: GameEvent, state: GameState): void {
  const p = state.player;
  if (!p.journal || event.actorId === p.id) return;
  const per = event.perception[p.id];
  const cs = (p.journal.clearSight ??= {});
  if (per?.level === 'full' && per.cue === 'sight') cs[event.actorId] = event.zone;
  else if (event.kind === 'move' || event.kind === 'flee') delete cs[event.actorId];
  if (!per && (event.kind === 'move' || event.kind === 'flee') && actorById(state, event.actorId)?.posture === 'stealthy') updateBeliefs(state, { kind: 'lost', observerId: p.id, aboutId: event.actorId });
}

/** NS2–NS4 (Ali, 08/11/2026): what `o` believes about `about`. NPCs read their knowledge; the player simply sees open actors and
 * keeps a belief (journal.stealthSeen) only about stealthy ones. */
export function beliefStatus(state: GameState, o: Actor, about: Actor): BeliefStatus {
  if (o.kind !== 'player') return o.mind?.knowledge[about.id]?.status ?? 'unaware';
  // an entry outlives the posture until stealthEnd (a melee blow from stealth is resolved as an ambush first)
  return o.journal?.stealthSeen?.[about.id] ?? (about.posture === 'stealthy' ? 'unaware' : 'aware');
}

/** NS2: an actor turning stealthy shakes off no one who sees it (ST12). The player keeps it as far as they see it now:
 * in their zone or one sight link away, half seen in the dark. NPC observers keep their knowledge as it is. */
export function stealthStart(state: GameState, a: Actor): void {
  const p = state.player;
  if (!p.journal || a.id === p.id) return;
  const d = isActive(p) ? dist(state, p.zone, a.zone, true) : null;
  const status: BeliefStatus = d === null || d > 1 ? 'unaware' : zoneLight(state, zoneById(state, a.zone)) === 'dark' ? 'suspicious' : 'aware';
  (p.journal.stealthSeen ??= {})[a.id] = status;
}
/** NS2: an actor turning open is simply seen again */
export function stealthEnd(state: GameState, a: Actor): void {
  delete state.player.journal?.stealthSeen?.[a.id];
}

/** Q17: is this a notice skill read by sight or sound (sight, hearing) */
export function noticeCue(skill: string): 'sight' | 'sound' | undefined {
  return getLibrary().skills[resolveAlias(skill)]?.cue;
}

/** Q17: a successful look shows everyone in the player's zone and the zones in sight of it clearly. */
export function lookAround(state: GameState): string[] {
  const p = state.player;
  if (!p.journal) return [];
  const cs = (p.journal.clearSight ??= {});
  const shown: string[] = [];
  for (const a of allActors(state)) {
    if (a.id === p.id) continue;
    const d = dist(state, p.zone, a.zone, true);
    if (d !== null && d <= 1) { cs[a.id] = a.zone; shown.push(a.id); }
  }
  return shown;
}

/** who perceives `event`, at the moment it happens (level and cue). The player's own events reach observers unaware of the player only through detection. */
export function computePerception(event: GameEvent, state: GameState, _rng: Rng): GameEvent['perception'] {
  const out: GameEvent['perception'] = {};
  const s = actorById(state, event.actorId);
  for (const a of allActors(state)) {
    // the player's events reach only those who already know of them; while stealthy, only those who see them (ST4)
    const min = state.player.posture === 'stealthy' ? 'aware' : 'suspicious';
    if (event.actorId === state.player.id && a.id !== state.player.id && !atLeast(a.mind?.knowledge[state.player.id]?.status, min)) continue;
    // NS2: a stealthy NPC's events reach only its band and those who see it
    if (s && s.kind !== 'player' && s.posture === 'stealthy' && a.id !== s.id && a.bandId !== s.bandId && !atLeast(beliefStatus(state, a, s), 'aware')) continue;
    const p = perceptionOf(event, state, a);
    if (p) out[a.id] = p;
  }
  return out;
}

const raise = (cur: BeliefStatus | undefined, to: BeliefStatus): BeliefStatus =>
  BELIEF_ORDER.indexOf(to) > BELIEF_ORDER.indexOf(cur ?? 'unaware') ? to : (cur ?? 'unaware');

function write(observer: Actor, aboutId: string, b: Partial<Belief>): Belief | undefined {
  if (!observer.mind || aboutId === observer.id) return undefined;
  const cur = observer.mind.knowledge[aboutId];
  const next: Belief = { ...(cur ?? { status: 'unaware', source: 'seen' }), ...b, revealed: [...(cur?.revealed ?? []), ...(b.revealed ?? [])].filter((x, i, arr) => arr.indexOf(x) === i) };
  observer.mind.knowledge[aboutId] = next;
  return next;
}

/** the ONLY writer of Belief. */
export function updateBeliefs(state: GameState, update: BeliefUpdate): void {
  if (update.kind === 'opening') {
    const o = actorById(state, update.observerId);
    if (o) write(o, update.aboutId, { status: update.status, source: update.source ?? 'seen', lastKnownZone: update.zone, lastSeenTurn: state.turn });
    return;
  }
  if (update.kind === 'reveal') {
    const o = actorById(state, update.observerId);
    if (o) write(o, update.aboutId, { revealed: [update.fact] });
    return;
  }
  const ss = (o: Actor | undefined) => (o?.kind === 'player' && o.journal ? (o.journal.stealthSeen ??= {}) : undefined);
  if (update.kind === 'lost') {
    // ST15: someone who saw you loses you when you vanish from them: suspicious, at the zone they last saw you in
    const o = actorById(state, update.observerId);
    const seen = ss(o); // NS2: the player loses a stealthy NPC the same way
    if (seen) { if (atLeast(seen[update.aboutId], 'aware')) seen[update.aboutId] = 'suspicious'; return; }
    if (o && atLeast(o.mind?.knowledge[update.aboutId]?.status, 'aware')) write(o, update.aboutId, { status: 'suspicious', ...(update.zone ? { lastKnownZone: update.zone } : {}) });
    return;
  }
  if (update.kind === 'detection') {
    const o = actorById(state, update.observerId);
    if (!o || update.status === 'unaware') return;
    const seen = ss(o);
    if (seen) { seen[update.aboutId] = raise(seen[update.aboutId], update.status); return; }
    const cue = perceptionOf(update.event, state, o)?.cue;
    write(o, update.aboutId, {
      status: raise(o.mind?.knowledge[update.aboutId]?.status, update.status),
      lastKnownZone: update.event.zone, lastSeenTurn: update.event.turn, source: cue === 'sound' ? 'heard' : 'seen',
    });
    return;
  }
  const e = update.event;
  if (e.bark) return; // a bark copies nothing and never enters an NPC's knowledge
  const sender = actorById(state, e.actorId);
  for (const [obsId, p] of Object.entries(e.perception)) {
    const o = actorById(state, obsId);
    if (!o || o.id === e.actorId) continue;
    // names the player learns from a line are written only by applyIntroduces (engine), which checks the speaker's knows
    if (!o.mind || !sender) continue;
    const cur = o.mind.knowledge[e.actorId]?.status;
    write(o, e.actorId, {
      status: p.level === 'full' ? (atLeast(cur, 'aware') ? 'tracking' : 'aware') : raise(cur, 'suspicious'),
      lastKnownZone: e.zone, lastSeenTurn: e.turn, source: p.cue === 'sound' ? 'heard' : 'seen',
    });
    if (e.kind === 'attack' && e.target) {
      const target = actorById(state, e.target);
      if (target && (target.id === o.id || target.bandId === o.bandId)) (o.mind.overrides ??= {})[e.actorId] = 'hostile';
      const inst = e.attack?.weaponId ?? e.itemId;
      const item = inst ? sender.core.inventory.find((i) => i.id === inst) : undefined;
      if (p.level === 'full' && item && itemDef(state, item.itemId).concealed) write(o, e.actorId, { revealed: [`item:${item.id}`] });
    }
    if (isComm(e) && sender.mind) {
      for (const [about, sb] of Object.entries(sender.mind.knowledge)) {
        if (about === o.id || sb.status === 'unaware') continue;
        const mine = o.mind.knowledge[about];
        if (atLeast(mine?.status, 'aware')) continue; // own sight beats hearsay
        write(o, about, {
          status: raise(mine?.status, 'suspicious'), // told is capped at suspicious
          source: 'told', lastKnownZone: sb.lastKnownZone, lastSeenTurn: sb.lastSeenTurn, revealed: sb.revealed,
        });
      }
    }
  }
}

/** one step down when lastSeenTurn is older than DECAY_TURNS. */
// GAP: "one step per DECAY_TURNS" read statelessly: a belief steps down at ages D+1, 2D+1, 3D+1 ... (called once per turn).
export function applyBeliefDecay(state: GameState): void {
  const D = CONFIG.DECAY_TURNS;
  for (const a of allActors(state)) {
    for (const b of Object.values(a.mind?.knowledge ?? {})) {
      if (b.lastSeenTurn === undefined || b.status === 'unaware') continue;
      const age = state.turn - b.lastSeenTurn;
      if (age > D && (age - 1) % D === 0) b.status = BELIEF_ORDER[BELIEF_ORDER.indexOf(b.status) - 1];
    }
  }
}
