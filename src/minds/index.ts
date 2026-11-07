// W5 — Routines (desired state), Explore mode (detection, ambush, alarm), the fallback combat list, the routine bank validator.
// Code minds read only ActorView, never GameState (test 26).
import type { ActorView, GameEvent, GameState, Order, OrderTemplate, Routine, RoutineSet, Rng, Actor, ActivityDef } from '../types';
import { todo } from '../todo';

export function desiredState(view: ActorView): { zone: string; activity: string } | null { return todo('desiredState'); }
/** routine order: one link toward the desired zone, else perform the activity (idle). */
export function routineOrder(view: ActorView): Order { return todo('routineOrder'); }
/** Fallback behavior: Flee > Attack > Close in > Search > Hold. source 'fallback'. */
export function fallbackOrder(view: ActorView, rng: Rng): Order { return todo('fallbackOrder'); }
/** Rule 1 only: the Flee order for a broken actor (source 'broken'); a surrendered actor holds. */
export function brokenOrder(view: ActorView): Order { return todo('brokenOrder'); }
/** bind an onAlert or trigger template for its owner ($player, $lastKnownZone, $triggerZone, $slot:x). */
export function bindTemplate(tpl: OrderTemplate, view: ActorView, ctx: { triggerZone?: string; source: Order['source']; triggerId?: string }): Order { return todo('bindTemplate'); }
/** install a routine set at scene setup: routines list, slots, current routine with its code-set anchor (startAt or seeded phase). */
export function installRoutines(actor: Actor, setId: string, slots: Record<string, string | string[]>, startAt: string | undefined, turn: number, rng: Rng): void { return todo('installRoutines'); }
/** an agent or bandmate switch; returns false (and logs invalid_routine / routine_skip) when not allowed. */
export function switchRoutine(state: GameState, actor: Actor, routineId: string, reason: 'agent' | 'bandmate'): boolean { return todo('switchRoutine'); }
/** alarm state machine after a turn's events: onAlert once (returns orders due this/next turn), alert variant, calm return with the saved anchor. */
export function updateAlarms(state: GameState, events: GameEvent[]): void { return todo('updateAlarms'); }
/** onAlert orders due now for actors with no higher order (called by the engine while merging). */
export function alertOrders(state: GameState, views: ActorView[]): Order[] { return todo('alertOrders'); }
/** Explore: detection on the player's major actions. Writes through updateBeliefs only. */
export function detectPlayer(state: GameState, event: GameEvent, rng: Rng): void { return todo('detectPlayer'); }
/** Explore: ambush before the blow. Returns whether the target is surprised. */
export function resolveAmbush(state: GameState, attackerId: string, targetId: string, attackEvent: GameEvent, rng: Rng): { surprised: boolean } { return todo('resolveAmbush'); }
/** routine bank import validator (designer tool). */
export function validateRoutineBank(bank: { routines: Record<string, Routine>; sets: Record<string, RoutineSet>; activities: Record<string, ActivityDef> }): { ok: boolean; errors: string[] } { return todo('validateRoutineBank'); }
