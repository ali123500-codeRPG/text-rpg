// State-side minds work: routine install and switch, the alarm machine, Explore detection and ambush.
import type { Actor, ActorView, GameEvent, GameState, Order, Rng, RollResult } from '../types';
import { CONFIG } from '../config';
import { routine as getRoutine, routineSet, creatureType, npcTemplate } from '../library';
import { actorById, atLeast, isActive, isEngaged, wary, zoneById } from '../engine/relations';
import { computePerception, perceptionOf, updateBeliefs } from '../perception';
import { markUse, ruleset, situational, tierLevel, usableModes, defaultMode, modeSkill } from '../ruleset';
import { hasPerk } from '../ruleset/perks';
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
    const waryKnown = Object.entries(a.mind.knowledge).filter(([id]) => {
      const o = actorById(state, id);
      return !!o && wary(state, a, o);
    });
    const leftUnaware = waryKnown.some(([, b]) => atLeast(b.status, 'suspicious'));
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
    // GAP: the armed flag also needs "unaware of every wary actor" (Hidden state persistence); the routine return uses the timer only (Alarm).
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

/** ST2 (Ali, 08/11/2026): Combat Stealth in an engagement, or for a shot, which starts one (ST5); Sneaking otherwise */
export const stealthSkill = (state: GameState, event?: GameEvent): string => (state.player.engagement || event?.kind === 'attack' ? 'combat_stealth' : 'sneaking');

/** ST3–ST8, ST11–ST19: while the player is stealthy, every observer who could perceive the event and doesn't already see the
 * player contests its sight or hearing against the player's stealth, once per event. Observer wins: aware. Tie: an unaware
 * observer turns suspicious. A Vanish (a move) is contested with Vanishing by everyone, those who see the player included:
 * one who loses it drops to suspicious at the zone the player left (ST15); for the rest it counts as a passed stealth check
 * (ST16). A shot's target that loses still turns suspicious, at the shooter's zone (ST19). Light and cover reach the
 * rolls by situation tag (CONFIG.SITUATION_TAGS, ST21); a hide ignores leg wounds (ST10). With Unblinking, an observer
 * who loses a Vanish must also lose a Sneaking or Combat Stealth contest (ST23). */
function stealthDetect(state: GameState, event: GameEvent, rng: Rng): void {
  const p = state.player;
  const hide = event.kind === 'hide';
  const vanish = !!event.vanish;
  const zone = zoneById(state, p.zone);
  const skill = vanish ? 'vanishing' : stealthSkill(state, event);
  // ST21/ST22: light and cover reach the rolls by situation tag; a Hide adds the hide tag and ignores leg wounds (ST10)
  const mine = (sk: string) => ({ actorId: p.id, skill: sk, ...situational(state, sk, { light: zone, cover: zone, add: hide ? ['hide'] : [] }), rollKind: 'stealth' as const, ...(hide ? { roles: [] } : {}) });
  const theirs = (a: Actor, sk: string) => ({ actorId: a.id, skill: sk, ...situational(state, sk, { light: zone }), rollKind: 'perception' as const });
  // one contest per observer per turn (ST4): a Vanish or a shot is not tested again by the turn's later events
  const sc = (state.scratch ??= {});
  const done = (sc.stealthContested as { turn: number; ids: string[] } | undefined)?.turn === state.turn ? (sc.stealthContested as { turn: number; ids: string[] }) : { turn: state.turn, ids: [] };
  sc.stealthContested = done;
  for (const a of state.actors) {
    if (!a.mind || !isActive(a) || done.ids.includes(a.id)) continue;
    const cur = a.mind.knowledge.player?.status ?? 'unaware';
    const sees = atLeast(cur, 'aware');
    if (sees && !vanish) continue; // ST12: Hide and Sneak never shake off someone who sees you
    const seen = perceptionOf(event, state, a);
    if (!seen) continue;
    const sense = seen.cue === 'sound' ? 'hearing' : 'sight';
    const r = ruleset.contested(mine(skill), theirs(a, sense), state, rng);
    done.ids.push(a.id);
    markUse(state, p, skill, r); // ST8
    log(state, 'stealth_contest', { observerId: a.id, skill, kind: event.kind, gap: r.gap });
    if (r.gap > 0) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: 'player', status: 'aware', event });
    else if (sees) {
      if (r.gap >= 0) continue;
      // ST23: an observer with Unblinking who loses the Vanish still needs beating with Sneaking or Combat Stealth
      if (hasPerk(a, 'unblinking')) {
        const second = stealthSkill(state);
        const r2 = ruleset.contested(mine(second), theirs(a, sense), state, rng);
        markUse(state, p, second, r2);
        log(state, 'stealth_contest', { observerId: a.id, skill: second, kind: event.kind, gap: r2.gap, perk: 'unblinking' });
        if (r2.gap >= 0) continue;
      }
      updateBeliefs(state, { kind: 'lost', observerId: a.id, aboutId: 'player', zone: event.fromZone });
    } else if (r.gap === 0 || (event.kind === 'attack' && event.target === a.id)) updateBeliefs(state, { kind: 'detection', observerId: a.id, aboutId: 'player', status: 'suspicious', event });
  }
}

export function detectPlayer(state: GameState, event: GameEvent, rng: Rng): void {
  if (state.player.posture === 'stealthy') return stealthDetect(state, event, rng);
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

/** the attack skill for the weapon used (ambush skill; OQ-4 settled 07/11/2026: every attack on an unaware actor rolls). */
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
    const gap = tierLevel(p) - tierLevel(ambush); // Part 1 §4 Contests: acting side wins below 0
    if (o.id === targetId && gap < 0) surprised = true;
    // ST7: a shot from stealth leaves noticing to the stealth contest (detectPlayer); a melee blow has already revealed
    if (gap > 0 && !(attackerId === state.player.id && state.player.posture === 'stealthy')) {
      updateBeliefs(state, { kind: 'detection', observerId: o.id, aboutId: attackerId, status: 'aware', event: attackEvent });
      raiseAlarm(state, o);
    }
  }
  return { surprised };
}
