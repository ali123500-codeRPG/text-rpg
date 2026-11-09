// Engagement (Part 2, Encounter modes, E1). An engagement is one encounter from an actor's point of
// view: a fight, a negotiation, or both. It starts when another actor is engaged with it in a fight (one of the two is
// hostile to the other and believes in it at suspicious or higher) or in talk (one speaks to the other). It ends once
// nothing has engaged it, either way, for ENGAGEMENT_END_TURNS turns in a row. Talk turning into a fight (or back)
// stays one engagement, so once-per-engagement effects and the end-of-engagement improvement rolls happen once.
import type { Actor, EngagementKind, GameEvent, GameState } from '../types';
import { CONFIG } from '../config';
import { actorById, allActors, atLeast, countsInFight, hostile, isActive } from './relations';
import { logCode } from './effects';

/** a is engaged with b in a fight: a counts in a fight, is hostile to b and believes in b at suspicious or higher */
function fightingWith(state: GameState, a: Actor, b: Actor): boolean {
  return countsInFight(a) && countsInFight(b) && hostile(state, a, b) && atLeast(a.mind?.knowledge?.[b.id]?.status, 'suspicious');
}

/** who engaged whom this turn, and how */
export function engagedThisTurn(state: GameState, events: GameEvent[]): Map<string, Set<EngagementKind>> {
  const out = new Map<string, Set<EngagementKind>>();
  const add = (id: string, k: EngagementKind) => { const s = out.get(id) ?? new Set(); s.add(k); out.set(id, s); };
  const all = allActors(state);
  for (const a of all) for (const b of all) if (a !== b && fightingWith(state, a, b)) { add(a.id, 'fight'); add(b.id, 'fight'); }
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
