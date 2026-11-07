// State-side minds work: routine install and switch, the alarm machine, Explore detection and ambush.
import type { Actor, ActorView, GameEvent, GameState, Order, Rng, RollResult } from '../types';
import { CONFIG } from '../config';
import { routine as getRoutine, routineSet, creatureType, npcTemplate } from '../library';
import { actorById, atLeast, isActive, isEngaged, opposed } from '../engine/relations';
import { computePerception, perceptionOf, updateBeliefs } from '../perception';
import { ruleset, usableModes, defaultMode, modeSkill } from '../ruleset';
import { bindTemplate, expandSteps, slotsRead } from './routines';

const log = (state: GameState, code: string, detail: Record<string, unknown>) => state.log.push({ turn: state.turn, code, detail });

export function installRoutines(actor: Actor, setId: string, slots: Record<string, string | string[]>, startAt: string | undefined, turn: number, rng: Rng): void {
  const set = routineSet(setId);
  if (!set) throw new Error(`unknown routine set ${setId}`);
  const mind = actor.mind!;
  mind.routineSetId = setId;
  mind.routines = [...set.routines];
  mind.slots = { ...slots };
  const r = getRoutine(set.routines[0]);
  const stops = r.kind === 'schedule' ? expandSteps(r, mind.slots) : [];
  const total = stops.reduce((n, s) => n + s.turns, 0);
  let anchorTurn = turn;
  const i = startAt ? stops.findIndex((s) => s.slot === startAt) : -1;
  if (i >= 0) anchorTurn = turn - stops.slice(0, i).reduce((n, s) => n + s.turns, 0);
  else if (!startAt && r.loop && total > 0) anchorTurn = turn - rng.int(0, total - 1);
  mind.routine = { id: r.id, anchorTurn };
}

export function switchRoutine(state: GameState, actor: Actor, routineId: string, reason: 'agent' | 'bandmate'): boolean {
  const mind = actor.mind;
  const r = mind?.routines?.includes(routineId) ? getRoutineOrNull(routineId) : null;
  const unbound = r ? slotsRead(r).filter((s) => !hasBinding(mind!.slots?.[s])) : [];
  if (!mind || !r || unbound.length) {
    log(state, reason === 'agent' ? 'invalid_routine' : 'routine_skip', { actorId: actor.id, routineId, ...(unbound.length ? { unbound } : {}) });
    return false;
  }
  mind.routine = { id: routineId, anchorTurn: state.turn };
  if (r.kind === 'wait') mind.slots = { ...mind.slots, here: actor.zone };
  if (mind.alarm?.returnTo) delete mind.alarm.returnTo;
  return true;
}

function getRoutineOrNull(id: string) {
  try {
    return getRoutine(id);
  } catch {
    return null;
  }
}
const hasBinding = (b: string | string[] | undefined) => (Array.isArray(b) ? b.length > 0 : !!b);

/** Calm bandmates [Proposed]: calm, routine-run bandmates of the spokesperson who perceived the exchange take its new routine. */
/**
 * Calm bandmates [Proposed] (Dialogue turn rules): when a spokesperson's output switches its routine, calm, code-run
 * bandmates who perceived the exchange switch to the same routine. The one rule for this; the engine calls it.
 * GAP: "calm" read as not engaged, alarm not armed, and no attack or alarm perceived within DECAY_TURNS.
 */
export function calmBandmatesSwitch(state: GameState, spokespersonId: string, routineId: string, heard: (actorId: string) => boolean): string[] {
  const sp = actorById(state, spokespersonId);
  if (!sp) return [];
  const switched: string[] = [];
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.id === sp.id || a.bandId !== sp.bandId || !isActive(a) || a.mind?.control !== 'code' || !heard(a.id)) continue;
    if (!isCalm(state, a)) continue; // engaged or alarmed bandmates decide through their own mind
    if (switchRoutine(state, a, routineId, 'bandmate')) switched.push(a.id);
  }
  return switched;
}

export function isCalm(state: GameState, a: Actor): boolean {
  const alarm = a.mind?.alarm;
  const last = alarm?.lastAlarmTurn;
  return !isEngaged(state, a) && !alarm?.armed && (last === undefined || state.turn - last >= CONFIG.DECAY_TURNS);
}

const ALARM_KINDS = new Set(['attack', 'alarm']);

/** onAlert once (queued as onAlertDue), switch to the alert variant anchored now, save returnTo. */
export function raiseAlarm(state: GameState, a: Actor): void {
  const mind = a.mind!;
  const alarm = (mind.alarm ??= { armed: false });
  alarm.lastAlarmTurn = state.turn;
  if (alarm.armed) return;
  alarm.armed = true;
  if (!mind.routine) return;
  const r = getRoutine(mind.routine.id);
  if (r.onAlert) alarm.onAlertDue = r.id;
  if (r.alert && mind.routines?.includes(r.alert)) {
    alarm.returnTo = { ...mind.routine };
    mind.routine = { id: r.alert, anchorTurn: state.turn };
  }
}

export function updateAlarms(state: GameState, events: GameEvent[]): void {
  for (const a of state.actors) {
    if (!a.mind || !isActive(a)) continue;
    const perceivedAlarm = events.some((e) => e.actorId !== a.id && ALARM_KINDS.has(e.kind) && !!e.perception[a.id]);
    const opposedKnown = Object.entries(a.mind.knowledge).filter(([id]) => {
      const o = actorById(state, id);
      return !!o && opposed(state, a, o);
    });
    const leftUnaware = opposedKnown.some(([, b]) => atLeast(b.status, 'suspicious'));
    if (perceivedAlarm || (leftUnaware && !a.mind.alarm?.armed)) {
      raiseAlarm(state, a);
      continue;
    }
    const alarm = a.mind.alarm;
    if (!alarm?.armed || state.turn - (alarm.lastAlarmTurn ?? state.turn) < CONFIG.DECAY_TURNS) continue;
    // calm: back to the saved routine with its saved anchor
    if (alarm.returnTo) {
      a.mind.routine = { ...alarm.returnTo };
      delete alarm.returnTo;
    }
    // GAP: the armed flag also needs "unaware of every opposed actor" (Hidden state persistence); the routine return uses the timer only (Alarm).
    if (!leftUnaware) {
      alarm.armed = false;
      delete alarm.onAlertDue;
    }
  }
}

export function alertOrders(state: GameState, views: ActorView[]): Order[] {
  const out: Order[] = [];
  for (const v of views) {
    const alarm = actorById(state, v.self.id)?.mind?.alarm;
    const due = alarm?.onAlertDue;
    if (!due) continue;
    delete alarm!.onAlertDue;
    const tpl = getRoutine(due).onAlert;
    if (tpl) out.push(bindTemplate(tpl, v, { source: 'onAlert' }));
  }
  return out;
}

export function detectPlayer(state: GameState, event: GameEvent, _rng: Rng): void {
  if (state.player.posture === 'sneaking') return; // D-8: sneaking waits on the Stealth tree; the player is always open
  for (const a of state.actors) {
    if (!a.mind || !isActive(a)) continue;
    const cur = a.mind.knowledge.player?.status ?? 'unaware';
    if (cur === 'aware' || cur === 'tracking') continue;
    // Observers unaware of the player are left out of event.perception (they perceive the player only through detection),
    // so detection reads the perception level directly.
    const level = event.perception[a.id]?.level ?? perceptionOf(event, state, a)?.level;
    if (!level) continue;
    const status = level === 'full' ? 'aware' : 'suspicious';
    if (status === cur) continue;
    updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: 'player', status, event });
  }
}

/** the attack skill for the weapon used (owner's recommendation for OQ-4 / ambush skill, pending Ali). */
function ambushSkill(state: GameState, attacker: Actor, itemId: string | undefined): string {
  const used = itemId ? usableModes(state, attacker).find((m) => m.itemId === itemId) : undefined;
  const m = used ?? defaultMode(state, attacker, 0);
  if (m) return modeSkill(m.mode);
  const tpl = attacker.core.templateId ? npcTemplate(state, attacker.core.templateId) : undefined;
  return tpl?.fallback?.attackSkill ?? creatureType(state, attacker.core.creatureTypeId).fallback.attackSkill;
}

export function resolveAmbush(state: GameState, attackerId: string, targetId: string, attackEvent: GameEvent, rng: Rng): { surprised: boolean } {
  const attacker = actorById(state, attackerId);
  if (!attacker) return { surprised: false };
  // GAP: perception before the blow: use the event's if already computed, else compute it now.
  // Every active NPC that could perceive the attack, including those unaware of the attacker (left out of computePerception).
  const perception: GameEvent['perception'] = Object.keys(attackEvent.perception).length ? { ...attackEvent.perception } : { ...computePerception(attackEvent, state, rng) };
  for (const o of state.actors) {
    if (perception[o.id] || o.id === attackerId) continue;
    const seen = perceptionOf(attackEvent, state, o);
    if (seen) perception[o.id] = seen;
  }
  const ids = [targetId, ...Object.keys(perception).filter((id) => id !== targetId && id !== attackerId).sort()];
  const observers = ids
    .map((id) => actorById(state, id))
    .filter((o): o is Actor => !!o && o.kind === 'npc' && isActive(o) && !atLeast(o.mind?.knowledge[attackerId]?.status, 'aware'));
  if (!observers.length) return { surprised: false };
  const ambush: RollResult = ruleset.roll({ actorId: attackerId, skill: ambushSkill(state, attacker, attackEvent.itemId), modifiers: [], tierShifts: [], itemId: attackEvent.itemId }, state, rng);
  let surprised = false;
  for (const o of observers) {
    const skill = perception[o.id]?.cue === 'sound' ? 'hearing' : 'sight';
    const p = ruleset.roll({ actorId: o.id, skill, modifiers: [], tierShifts: [], rollKind: 'perception' }, state, rng);
    const gap = p.tier - ambush.tier; // Part 1 §4 Contests: acting side wins below 0
    if (o.id === targetId && gap < 0) surprised = true;
    if (gap > 0) {
      updateBeliefs(state, { kind: 'detection', observerId: o.id, aboutId: attackerId, status: 'aware', event: attackEvent });
      raiseAlarm(state, o);
    }
  }
  return { surprised };
}
