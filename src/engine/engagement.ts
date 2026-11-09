// Engagement (Part 2, Encounter modes, E1). An engagement is one encounter from an actor's point of
// view: a fight, a spar, a negotiation, or any of them. It starts when another actor is engaged with it in a fight (one of the two is
// hostile to the other and believes in it at suspicious or higher) or in talk (one speaks to the other). It ends once
// nothing has engaged it, either way, for ENGAGEMENT_END_TURNS turns in a row. Talk turning into a fight (or back)
// stays one engagement, so once-per-engagement effects and the end-of-engagement improvement rolls happen once.
import type { Actor, EngagementKind, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { actorById, allActors, atLeast, countsInFight, hostile, isActive, sparring } from './relations';
import { logCode } from './effects';

/** a is engaged with b in a fight: a counts in a fight, is hostile to b and believes in b at suspicious or higher */
export function fightingWith(state: GameState, a: Actor, b: Actor): boolean {
  return countsInFight(a) && countsInFight(b) && hostile(state, a, b) && atLeast(a.mind?.knowledge?.[b.id]?.status, 'suspicious');
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
  for (const a of all) for (const b of all) if (a !== b && fightingWith(state, a, b)) { add(a.id, 'fight'); add(b.id, 'fight'); }
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
  for (const a of allActors(state)) {
    const kinds = now.get(a.id);
    const e = a.engagement;
    if (kinds && !brk) {
      if (!e) {
        a.engagement = { start: state.turn, last: state.turn, kinds: [...kinds] };
        logCode(state, 'engagement_started', { actorId: a.id, kinds: [...kinds] });
      } else {
        e.last = state.turn;
        for (const k of kinds) if (!e.kinds.includes(k)) e.kinds.push(k);
      }
    } else if (e && (brk || state.turn - e.last >= CONFIG.ENGAGEMENT_END_TURNS)) {
      delete a.engagement;
      delete a.haggle; // PY6: haggled prices last until the engagement ends
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
