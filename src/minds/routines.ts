// Code minds: routines (desired state) and the fallback combat list. They read only ActorView, never GameState.
import type { ActorView, MapZone, Order, OrderTemplate, Routine, Rng } from '../types';
import { CONFIG } from '../config';
import { routine as getRoutine } from '../library';

export type Stop = { slot: string; zone: string; turns: number; activity: string };

/** a route slot expands to one stop per bound zone; an unbound slot gives no stop. */
export function expandSteps(r: Routine, slots: Record<string, string | string[]>): Stop[] {
  const out: Stop[] = [];
  for (const st of r.steps) {
    const b = slots[st.slot];
    const zones = b === undefined ? [] : Array.isArray(b) ? b : [b];
    for (const zone of zones) out.push({ slot: st.slot, zone, turns: CONFIG.DURATIONS[st.duration], activity: st.activity });
  }
  return out;
}

/** slots a routine reads (steps and onAlert $slot targets); 'here' is code-written and left out. */
export function slotsRead(r: Routine): string[] {
  const s = new Set(r.steps.map((st) => st.slot));
  const t = r.onAlert?.target;
  if (typeof t === 'string' && t.startsWith('$slot:')) s.add(t.slice(6));
  s.delete('here');
  return [...s];
}

export function desiredState(view: ActorView): { zone: string; activity: string } | null {
  const cur = view.self.routine;
  if (!cur) return null;
  const r = getRoutine(cur.id);
  if (r.kind === 'follow') {
    const b = view.beliefs.find((x) => x.about === 'player');
    // GAP: follow with no belief about the player: the smallest reading is to stay where it is.
    return { zone: b?.lastKnownZone ?? view.self.zone, activity: r.activity ?? 'rest' };
  }
  if (r.kind === 'wait') {
    const here = view.self.slots.here;
    // GAP: a wait routine with 'here' unbound (never switched to): stay in the current zone.
    return { zone: (Array.isArray(here) ? here[0] : here) ?? view.self.zone, activity: r.activity ?? 'rest' };
  }
  const stops = expandSteps(r, view.self.slots);
  if (!stops.length) return null;
  const total = stops.reduce((n, s) => n + s.turns, 0);
  let t = view.turn - cur.anchorTurn;
  if (r.loop) t = ((t % total) + total) % total;
  else if (t >= total) return { zone: stops[stops.length - 1].zone, activity: stops[stops.length - 1].activity };
  t = Math.max(0, t);
  for (const s of stops) {
    if (t < s.turns) return { zone: s.zone, activity: s.activity };
    t -= s.turns;
  }
  return null; // unreachable: t < total
}

/** shortest path over the view's map, never through a frontier link; zone ids after `from`, or null. */
export function mapPath(map: MapZone[], from: string, to: string): string[] | null {
  if (from === to) return [];
  const byId = new Map(map.map((z) => [z.id, z]));
  const prev = new Map<string, string>([[from, from]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const l of byId.get(cur)?.links ?? []) {
      if (l.frontier || !byId.has(l.to) || prev.has(l.to)) continue;
      prev.set(l.to, cur);
      if (l.to === to) {
        const path = [to];
        for (let p = cur; p !== from; p = prev.get(p)!) path.unshift(p);
        return path;
      }
      q.push(l.to);
    }
  }
  return null;
}

const order = (view: ActorView, type: string, source: Order['source'], intent: string, extra: Partial<Order> = {}): Order =>
  ({ actorId: view.self.id, type, target: null, skill: null, intent, source, ...extra });

/** marks a routine order whose desired zone has no path; the engine logs routine_unreachable [Proposed]. */
export const UNREACHABLE = 'routine_unreachable';

export function routineOrder(view: ActorView): Order {
  const d = desiredState(view);
  if (!d) return order(view, 'hold', 'routine', 'hold');
  if (d.zone === view.self.zone) return order(view, 'idle', 'routine', d.activity, { activity: d.activity });
  const path = mapPath(view.map, view.self.zone, d.zone);
  if (!path) return order(view, 'idle', 'routine', UNREACHABLE, { activity: d.activity });
  return order(view, 'move', 'routine', `walk toward ${d.zone}`, { target: path[0], activity: d.activity });
}

function opposedBeliefs(view: ActorView) {
  return view.beliefs.filter((b) => b.opposed && b.active && b.status !== 'unaware');
}

export function brokenOrder(view: ActorView): Order {
  return flee(view, 'broken');
}

function flee(view: ActorView, source: Order['source']): Order {
  const hold = () => order(view, 'hold', source, 'hold');
  if (view.self.surrendered || view.self.fearless) return hold();
  const here = view.self.zone;
  for (const key of ['exit', 'refuge']) {
    const b = view.self.slots[key];
    const zone = Array.isArray(b) ? b[0] : b;
    if (!zone) continue;
    if (zone === here) return hold();
    const path = mapPath(view.map, here, zone);
    if (path) return order(view, 'flee', source, 'flee', { target: path[0] });
  }
  // away from the nearest opposed actor it believes in: a linked zone farther from it than here; else hold.
  const dist = (a: string, b: string) => mapPath(view.map, a, b)?.length ?? Infinity;
  const threats = opposedBeliefs(view).filter((b) => b.lastKnownZone).map((b) => b.lastKnownZone!);
  if (!threats.length) return hold();
  const threat = threats.reduce((best, z) => (dist(here, z) < dist(here, best) ? z : best));
  const links = view.map.find((z) => z.id === here)?.links ?? [];
  let best: string | null = null;
  let bestD = dist(here, threat);
  for (const l of links) {
    if (l.frontier || !view.map.some((z) => z.id === l.to)) continue;
    const d = dist(l.to, threat);
    if (d > bestD) [best, bestD] = [l.to, d];
  }
  return best ? order(view, 'flee', source, 'flee', { target: best }) : hold();
}

export function fallbackOrder(view: ActorView, rng: Rng): Order {
  const s = view.self;
  // 1. Flee (fearless actors never break)
  if ((s.broken || s.surrendered) && !s.fearless) return flee(view, 'fallback');
  // 2. Attack
  const here = view.beliefs
    .filter((b) => b.opposed && b.active && (b.status === 'aware' || b.status === 'tracking') && b.lastKnownZone === s.zone)
    .map((b) => b.about)
    .sort();
  if (here.length) {
    const target = s.lastHitBy && here.includes(s.lastHitBy) ? s.lastHitBy
      : here.includes('player') ? 'player'
      : here.length === 1 ? here[0] : here[rng.int(0, here.length - 1)];
    return order(view, 'attack', 'fallback', 'attack', { target, skill: s.attackSkill, targetPart: null, aimed: false });
  }
  // 3. Close in / 4. Search
  const recent = opposedBeliefs(view)
    .filter((b) => b.lastKnownZone)
    .sort((a, b) => (b.lastSeenTurn ?? -1) - (a.lastSeenTurn ?? -1) || a.about.localeCompare(b.about))[0];
  if (recent) {
    const zone = recent.lastKnownZone!;
    if (zone === s.zone) return order(view, 'search', 'fallback', 'search', { target: zone });
    const path = mapPath(view.map, s.zone, zone);
    if (path) return order(view, 'move', 'fallback', `close in on ${zone}`, { target: path[0] });
  }
  // 5. Hold
  return order(view, 'hold', 'fallback', 'hold');
}

export function bindTemplate(tpl: OrderTemplate, view: ActorView, ctx: { triggerZone?: string; source: Order['source']; triggerId?: string }): Order {
  const t = tpl.target;
  let target: string | null = t;
  if (t === '$player') target = 'player';
  else if (t === '$lastKnownZone') target = view.beliefs.find((b) => b.about === 'player')?.lastKnownZone ?? null;
  else if (t === '$triggerZone') target = ctx.triggerZone ?? null;
  else if (t?.startsWith('$slot:')) {
    const b = view.self.slots[t.slice(6)];
    target = (Array.isArray(b) ? b[0] : b) ?? null;
  }
  return { ...tpl, actorId: view.self.id, target, source: ctx.source, ...(ctx.triggerId ? { triggerId: ctx.triggerId } : {}) };
}
