// Hidden state persistence: triggers at turn start and mid-turn, once, firedLog, bound fired orders.
import type { Actor, GameEvent, GameState, Order, Trigger } from '../types';
import { actorById, atLeast, isActive } from './relations';
import { buildActorView } from '../views';
import { bindTemplate } from '../minds';

/** the owner's own beliefs/perception decide; `events` are the events the condition may read. */
export function triggerHolds(state: GameState, t: Trigger, owner: Actor, events: GameEvent[], when: 'start' | 'mid', turn: number): boolean {
  const w = t.when;
  switch (w.type) {
    case 'player_seen_in_zone': {
      const b = owner.mind?.knowledge[state.player.id];
      // GAP: "seen in zone" read as a fresh, first-hand sighting: source 'seen', lastSeenTurn = the latest resolved turn.
      return !!b && atLeast(b.status, 'suspicious') && b.source === 'seen' && b.lastKnownZone === w.zone && b.lastSeenTurn === state.turn;
    }
    case 'turn_reached':
      return when === 'start' && turn >= w.turn;
    case 'actor_down': {
      const down = actorById(state, w.actorId);
      // GAP: the owner must have perceived an event involving the downed actor (its own perception, not truth).
      return !!down && !isActive(down) && events.some((e) => (e.target === w.actorId || e.actorId === w.actorId) && !!e.perception[owner.id]);
    }
    case 'alarm_heard':
      return when === 'start' && events.some((e) => e.kind === 'alarm' && !!e.perception[owner.id]);
  }
  return false;
}

function triggerZone(t: Trigger): string | undefined {
  return t.when.type === 'player_seen_in_zone' ? t.when.zone : undefined;
}

/** fire one trigger: bind its order, write firedLog, remove a once trigger from its plan. */
function fire(state: GameState, ownerId: string, t: Trigger, turn: number, bind: boolean): Order | null {
  state.hidden.firedLog.push({ triggerId: t.id, turn, ownerId });
  const plan = state.hidden.plans[ownerId];
  if (t.once && plan) plan.triggers = plan.triggers.filter((x) => x !== t);
  if (!bind) return null;
  const view = buildActorView(state, ownerId);
  return { ...bindTemplate(t.then, view, { triggerZone: triggerZone(t), source: 'trigger', triggerId: t.id }), actorId: ownerId, source: 'trigger', triggerId: t.id };
}

function ownedTriggers(state: GameState): [string, Trigger[]][] {
  return Object.keys(state.hidden.plans)
    .sort()
    .map((id) => [id, state.hidden.plans[id].triggers.filter((t) => (t.ownerId ?? id) === id)]);
}

/** Turn start (after the previous turn is saved). Returns the bound orders (first holding trigger per owner) and every fired id. */
export function fireTurnStartTriggers(state: GameState, turn: number): { orders: Order[]; fired: string[] } {
  const orders: Order[] = [];
  const fired: string[] = [];
  for (const [ownerId, triggers] of ownedTriggers(state)) {
    const owner = actorById(state, ownerId);
    if (!owner || !isActive(owner)) continue; // inactive owners: triggers stay armed
    const holding = triggers.filter((t) => triggerHolds(state, t, owner, state.events, 'start', turn));
    holding.forEach((t, i) => {
      const o = fire(state, ownerId, t, turn, i === 0);
      if (o) orders.push(o);
      fired.push(t.id);
    });
  }
  return { orders, fired };
}

/** Mid-turn: after each event, player_seen_in_zone and actor_down only, for owners that haven't acted. First holding trigger wins. */
export function fireMidTurnTrigger(state: GameState, owner: Actor, event: GameEvent): Order | null {
  const plan = state.hidden.plans[owner.id];
  if (!plan || !isActive(owner)) return null;
  const t = plan.triggers.find(
    (x) => (x.ownerId ?? owner.id) === owner.id && (x.when.type === 'player_seen_in_zone' || x.when.type === 'actor_down') &&
      triggerHolds(state, x, owner, [event], 'mid', state.turn),
  );
  return t ? fire(state, owner.id, t, state.turn, true) : null;
}

/** bound turn-start orders saved by computePending; the pipeline passes them as TurnInput.fired. */
export function firedOrders(state: GameState): Order[] {
  const orders = (state.scratch?.firedOrders as Order[] | undefined) ?? [];
  return orders.filter((o) => {
    const a = actorById(state, o.actorId);
    return !!a && isActive(a);
  });
}
