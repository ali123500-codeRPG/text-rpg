// D-230 a: watchdogs. A dog on a barking routine (Routine.barks, the watchdog routine set) barks at a stranger it senses.
import type { GameState, Order } from '../types';
import { getLibrary } from '../library';
import { beliefStatus } from '../perception';
import { allActors, atLeast, isActive, isAsleep, isEngaged, stance, warm } from './relations';
import { sameGroup } from './belonging';

/** D-230 a: each turn, every watchdog that is awake, active, unbroken and not in a fight barks while it is at least
 * Suspicious of a stranger: anyone outside its groups (sameGroup) it is not warm toward. A bark is a call for help, a Loud
 * noise, so whom it wakes and alerts comes from the hearing rules. Ways past: stay unsensed (sneak), or silence the dog. */
export function barkCalls(state: GameState): Order[] {
  const out: Order[] = [];
  for (const d of state.actors) {
    const r = d.mind?.routine ? getLibrary().routines?.[d.mind.routine.id] : undefined;
    if (!r?.barks || !isActive(d) || isAsleep(d) || d.mind!.moraleState || isEngaged(state, d)) continue;
    const stranger = allActors(state).some((t) => t !== d && isActive(t) && !sameGroup(state, d, t) && !warm(stance(state, d, t)) && atLeast(beliefStatus(state, d, t), 'suspicious'));
    if (stranger) out.push({ actorId: d.id, type: 'call_help', target: null, skill: null, intent: 'bark at a stranger', source: 'routine' });
  }
  return out;
}
