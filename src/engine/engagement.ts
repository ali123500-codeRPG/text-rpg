// Engagement (Part 2, Encounter modes, E1). An engagement is one encounter from an actor's point of
// view: a fight, a spar, a negotiation, or any of them. It starts when another actor is engaged with it in a fight (one of the two is
// hostile to the other and the two are engaged, YD6) or in talk (one speaks to the other). It ends once
// nothing has engaged it, either way, for ENGAGEMENT_END_TURNS turns in a row. Talk turning into a fight (or back)
// stays one engagement, so once-per-engagement effects and the end-of-engagement improvement rolls happen once.
import type { Actor, EngagementKind, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { actorById, allActors, atLeast, countsInFight, hostile, isActive, shortestPath, sparring } from './relations';
import { logCode } from './effects';
import { calm } from './heal';
import { CP } from '../library/tableIds';
import { yieldAllTaken } from './yield';

/** YD6: either of the two holds the other at the top awareness state, engaged (they traded blows, or one struck the other's side) */
export function engagedPair(a: Actor, b: Actor): boolean {
  return a.mind?.knowledge?.[b.id]?.status === 'engaged' || b.mind?.knowledge?.[a.id]?.status === 'engaged';
}

/** a is fighting b: both count in a fight, a is hostile to b, and the two are engaged (YD6). A hostile that only tracks
 * or hunts b, such as one listening from another room, is not in the fight (BG-4) */
export function fightingWith(state: GameState, a: Actor, b: Actor): boolean {
  return countsInFight(a) && countsInFight(b) && hostile(state, a, b) && engagedPair(a, b);
}

/** raises a's awareness of b to `status` (never lowers it) and marks this turn as one of attacking or closing in */
function press(state: GameState, a: Actor, b: Actor, status: 'hunting' | 'engaged'): void {
  const k = a.mind?.knowledge;
  if (!k) return;
  const cur = k[b.id];
  const next = atLeast(cur?.status, status) ? cur!.status : status;
  k[b.id] = { ...(cur ?? { source: 'seen', revealed: [] }), status: next, closedTurn: state.turn, lastKnownZone: b.zone, lastSeenTurn: state.turn };
}
const links = (state: GameState, from: string, to: string) => shortestPath(state, from, to)?.length ?? Infinity;

/** YD6 each turn, after the blows and moves: a real (not sparring) blow engages attacker and target, and the target's
 * bandmates who saw or heard it, once they know who struck. A hostile that knows where someone is and moves closer is hunting
 * them (or stays engaged). Hunting and engaged drop to tracking after ENGAGEMENT_END_TURNS turns in which neither of the
 * two attacked or closed in on the other (BG-5: a fight you walked away from ends). */
export function noteFighting(state: GameState, events: GameEvent[]): void {
  for (const e of events) {
    const a = actorById(state, e.actorId);
    if (!a) continue;
    if (e.kind === 'attack' && e.target && !e.spar) {
      const t = actorById(state, e.target);
      if (!t || t === a) continue;
      // the attacker is engaged with its target; the target, and its bandmates, only once they know who struck (a shot from hiding leaves them suspicious)
      const knows = (m: Actor) => atLeast(m.mind?.knowledge?.[a.id]?.status, 'aware');
      press(state, a, t, 'engaged');
      if (knows(t)) press(state, t, a, 'engaged');
      for (const m of allActors(state)) if (m !== t && m !== a && m.bandId === t.bandId && e.perception[m.id] && knows(m)) press(state, m, a, 'engaged');
    }
    if (e.kind === 'move' && (e.fromZone || e.target)) {
      for (const b of allActors(state)) {
        // a move into a zone nearer b, or a step inside one zone that closes in on b (step 2)
        const closer = e.fromZone ? links(state, a.zone, b.zone) < links(state, e.fromZone, b.zone) : e.target === b.id;
        if (b === a || !isActive(b) || !closer) continue;
        const mine = a.mind?.knowledge?.[b.id], theirs = b.mind?.knowledge?.[a.id];
        if (hostile(state, a, b) && atLeast(mine?.status, 'aware')) press(state, a, b, 'hunting');
        else if (a === state.player && theirs?.status === 'engaged') theirs.closedTurn = state.turn; // the player keeps a fight alive by closing in
      }
    }
  }
  for (const a of allActors(state)) for (const [id, b] of Object.entries(a.mind?.knowledge ?? {})) {
    if (!atLeast(b.status, 'hunting')) continue;
    const other = actorById(state, id);
    const back = other?.mind?.knowledge?.[a.id];
    const last = Math.max(b.closedTurn ?? -Infinity, back?.status === 'engaged' ? (back.closedTurn ?? -Infinity) : -Infinity);
    if (state.turn - last >= CONFIG.ENGAGEMENT_END_TURNS) b.status = 'tracking';
  }
}

/** an ally of the player: not the player, not hostile to them, and fighting (or fought by) someone who is fighting the player.
 * The code keeps no ally list: a side is whoever is fighting your foes without being hostile to you. */
export function besidePlayer(state: GameState, a: Actor): boolean {
  const p = state.player;
  if (a === p || !countsInFight(a) || !countsInFight(p) || hostile(state, a, p)) return false;
  return allActors(state).some((o) => o !== a && fightingWith(state, o, p) && (fightingWith(state, a, o) || fightingWith(state, o, a)));
}

/** who engaged whom this turn, and how */
export function engagedThisTurn(state: GameState, events: GameEvent[]): Map<string, Set<EngagementKind>> {
  const out = new Map<string, Set<EngagementKind>>();
  const add = (id: string, k: EngagementKind) => { const s = out.get(id) ?? new Set(); s.add(k); out.set(id, s); };
  const all = allActors(state);
  // a fight counts on turns either side attacks or closes in (YD6), so the quiet turns that drop engaged also end the engagement
  const active = (a: Actor, b: Actor) => Math.max(a.mind?.knowledge?.[b.id]?.closedTurn ?? -Infinity, b.mind?.knowledge?.[a.id]?.closedTurn ?? -Infinity) >= state.turn;
  for (const a of all) for (const b of all) if (a !== b && fightingWith(state, a, b) && active(a, b)) { add(a.id, 'fight'); add(b.id, 'fight'); }
  // SP1: a spar is an engagement of its own kind
  for (const a of all) for (const b of all) if (a !== b && countsInFight(a) && countsInFight(b) && sparring(state, a, b)) { add(a.id, 'spar'); add(b.id, 'spar'); }
  for (const e of events) {
    if (e.kind !== 'speak' || e.bark) continue;
    const speaker = actorById(state, e.actorId);
    if (!speaker || !isActive(speaker)) continue;
    for (const id of new Set([...(e.speech?.addressees ?? []), ...(e.target ? [e.target] : [])])) {
      const other = actorById(state, id);
      if (!other || other === speaker || !isActive(other)) continue;
      add(speaker.id, 'talk'); add(other.id, 'talk');
    }
  }
  return out;
}

/** Updates every actor's engagement for this turn. Returns true when the player's engagement ended this turn.
 * A scene break ends every engagement. */
export function updateEngagements(state: GameState, events: GameEvent[]): boolean {
  const now = engagedThisTurn(state, events);
  const brk = !!state.stage.breakCause;
  let playerEnded = false;
  // YD3: once everyone who heard the player's yield has taken it, the player's fight ends now (hostiles who never heard it
  // start a new one); the player's beliefs are not kept, so the takers' engaged beliefs about the player drop to tracking
  const yielded = yieldAllTaken(state) && !state.yielding!.ended;
  if (yielded) {
    state.yielding!.ended = true;
    for (const id of state.yielding!.accepted) { const b = actorById(state, id)?.mind?.knowledge?.[state.player.id]; if (b && atLeast(b.status, 'hunting')) b.status = 'tracking'; }
  }
  for (const a of allActors(state)) {
    if (brk) delete a.auraChecks; // a scene break ends every engagement, and the auras check afresh
    const kinds = yielded && a === state.player ? undefined : now.get(a.id);
    const e = a.engagement;
    if (kinds && !brk) {
      if (!e) {
        a.engagement = { start: state.turn, last: state.turn, kinds: [...kinds] };
        logCode(state, 'engagement_started', { actorId: a.id, kinds: [...kinds] });
      } else {
        e.last = state.turn;
        for (const k of kinds) if (!e.kinds.includes(k)) e.kinds.push(k);
      }
    } else if (e && (brk || (yielded && a === state.player) || state.turn - e.last >= CONFIG.ENGAGEMENT_END_TURNS)) {
      delete a.engagement;
      delete a.haggle; // PY6: haggled prices last until the engagement ends
      delete a.pressure; // OQ-29: Shaken and Swayed last until the engagement ends
      delete a.speechTries; // NT3: repeat tries count within one engagement
      delete a.auraChecks; // I4: each aura checks once per engagement
      calm(state, a, CP.danger_passed); // MB9: some nerve comes back when the danger has passed (composure table)
      logCode(state, 'engagement_ended', { actorId: a.id, start: e.start, kinds: e.kinds });
      if (a === state.player) playerEnded = true;
    }
  }
  return playerEnded;
}

/** once-per-engagement effects: true if `id` may still be used in the actor's current engagement */
export function usableThisEngagement(a: Actor, id: string, times = 1): boolean {
  return !!a.engagement && (a.engagement.uses?.[id] ?? 0) < times;
}
export function useThisEngagement(a: Actor, id: string): void {
  if (!a.engagement) return;
  a.engagement.uses = { ...(a.engagement.uses ?? {}), [id]: (a.engagement.uses?.[id] ?? 0) + 1 };
}
