// Code minds: routines (desired state) and the fallback combat list. They read only ActorView, never GameState.
import type { ActorView, MapZone, Order, OrderTemplate, Routine, Rng } from '../types';
import { CONFIG } from '../config';
import { AWARENESS } from '../scales';
import { routine as getRoutine } from '../library';

/** BG-34: the follow routine any NPC may switch to when it agrees to come along with the player, whatever its set */
export const FOLLOW_ROUTINE = 'follow';
/** the routines an NPC's agent may pick: its set's, plus follow (BG-34) */
export const offeredRoutines = (own: string[] | undefined): string[] => [...new Set([...(own ?? []), FOLLOW_ROUTINE])];
/** NW2: the shared routine an agent's headTo switches an NPC to: it walks to slot 'dest', then back to its routine */
export const HEAD_TO = 'head_to';

/** NW2: where a head_to walk goes: the destination zone, or for a frontier the nearest zone with a way into it (it
 * steps through from there); null when the destination is not on its map */
function headGoal(view: ActorView, dest: string): { zone: string; frontier?: string } | null {
  if (view.map.some((z) => z.id === dest)) return { zone: dest };
  const edges = view.map.filter((z) => z.links.some((l) => l.frontier && l.to === dest)).map((z) => z.id);
  if (!edges.length) return null;
  const dist = (z: string) => mapPath(view.map, view.self.zone, z)?.length ?? Infinity;
  return { zone: edges.reduce((best, z) => (dist(z) < dist(best) ? z : best)), frontier: dest };
}

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
  if (r.kind === 'head') {
    const dest = view.self.slots.dest;
    const g = headGoal(view, (Array.isArray(dest) ? dest[0] : dest) ?? view.self.zone);
    // GAP: a destination gone from its map (or never bound): it stays where it is until code sends it back
    return { zone: g?.zone ?? view.self.zone, activity: r.activity ?? 'walk' };
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

/** shortest path over the view's map, never through a frontier link, a drop (SD7: NPCs do not jump yet) or a way shut to it (BA7); zone ids after `from`, or null. */
export function mapPath(map: MapZone[], from: string, to: string): string[] | null {
  if (from === to) return [];
  const byId = new Map(map.map((z) => [z.id, z]));
  const prev = new Map<string, string>([[from, from]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const l of byId.get(cur)?.links ?? []) {
      if (l.frontier || l.drop || l.shut || !byId.has(l.to) || prev.has(l.to)) continue;
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

/** BG-34: an agent-run NPC on a follow routine walks toward the player beside whatever action its agent gave (a zone, or
 * null); NW2: on head_to it walks on toward where it is going, the same way */
export function followMove(view: ActorView): string | null {
  const cur = view.self.routine;
  const kind = cur ? getRoutine(cur.id).kind : null;
  if (kind !== 'follow' && kind !== 'head') return null;
  const d = desiredState(view);
  if (d && d.zone === view.self.zone && kind === 'head') return headFrontier(view);
  return d && d.zone !== view.self.zone && mapPath(view.map, view.self.zone, d.zone) ? d.zone : null;
}
/** NW2: a head_to walk standing at the edge of the frontier it is bound for steps into it (a frontier id), else null */
function headFrontier(view: ActorView): string | null {
  const cur = view.self.routine;
  if (!cur || getRoutine(cur.id).kind !== 'head') return null;
  const dest = view.self.slots.dest;
  const g = headGoal(view, (Array.isArray(dest) ? dest[0] : dest) ?? view.self.zone);
  return g?.frontier && g.zone === view.self.zone ? g.frontier : null;
}

/** marks a routine order whose desired zone has no path; the engine logs routine_unreachable [Proposed]. */
export const UNREACHABLE = 'routine_unreachable';

export function routineOrder(view: ActorView): Order {
  const d = desiredState(view);
  if (!d) return order(view, 'hold', 'routine', 'hold');
  const into = headFrontier(view);
  if (into) return order(view, 'move', 'routine', `walk into ${into}`, { target: into, activity: d.activity });
  if (d.zone === view.self.zone) return order(view, 'idle', 'routine', d.activity, { activity: d.activity });
  const path = mapPath(view.map, view.self.zone, d.zone);
  if (!path) return order(view, 'idle', 'routine', UNREACHABLE, { activity: d.activity });
  return order(view, 'move', 'routine', `walk toward ${d.zone}`, { target: path[0], activity: d.activity });
}

/** those it fights: hostile, or a spar opponent (SP1) */
function hostileBeliefs(view: ActorView) {
  return view.beliefs.filter((b) => (b.hostile || b.sparring) && b.active && b.status !== 'unaware');
}
/** whom a broken actor runs from: those it is hostile to, and those it yielded to (Q4) */
const fleeFrom = (view: ActorView) => view.beliefs.filter((b) => (b.hostile || b.stance === 'yielded') && b.active && b.status !== 'unaware');

export function brokenOrder(view: ActorView): Order {
  return flee(view, 'broken');
}

function flee(view: ActorView, source: Order['source']): Order {
  const hold = () => order(view, 'hold', source, 'hold');
  if (view.self.surrendered) return hold();
  const here = view.self.zone;
  for (const key of ['exit', 'refuge']) {
    const b = view.self.slots[key];
    const zone = Array.isArray(b) ? b[0] : b;
    if (!zone) continue;
    if (zone === here) return hold();
    const path = mapPath(view.map, here, zone);
    if (path) return order(view, 'flee', source, 'flee', { target: path[0] });
  }
  // away from the nearest hostile actor it believes in: a linked zone farther from it than here; else hold.
  const dist = (a: string, b: string) => mapPath(view.map, a, b)?.length ?? Infinity;
  const threats = fleeFrom(view).filter((b) => b.lastKnownZone).map((b) => b.lastKnownZone!);
  if (!threats.length) return hold();
  const threat = threats.reduce((best, z) => (dist(here, z) < dist(here, best) ? z : best));
  const links = view.map.find((z) => z.id === here)?.links ?? [];
  let best: string | null = null;
  let bestD = dist(here, threat);
  for (const l of links) {
    if (l.frontier || l.drop || l.shut || !view.map.some((z) => z.id === l.to)) continue;
    const d = dist(l.to, threat);
    if (d > bestD) [best, bestD] = [l.to, d];
  }
  return best ? order(view, 'flee', source, 'flee', { target: best }) : hold();
}

export function fallbackOrder(view: ActorView, rng: Rng): Order {
  const s = view.self;
  // 1. Flee
  if (s.broken || s.surrendered) return flee(view, 'fallback');
  // 2. Attack
  const here = view.beliefs
    .filter((b) => (b.hostile || b.sparring) && b.active && !b.lost && AWARENESS.pos(b.status) >= AWARENESS.pos('aware') && b.lastKnownZone === s.zone)
    .map((b) => b.about)
    .sort();
  if (here.length) {
    const target = s.lastHitBy && here.includes(s.lastHitBy) ? s.lastHitBy
      : here.includes('player') ? 'player'
      : here.length === 1 ? here[0] : here[rng.int(0, here.length - 1)];
    return order(view, 'attack', 'fallback', 'attack', { target, skill: s.attackSkill, targetPart: null, aimed: false });
  }
  // 3. Close in / 4. Search (CH7: not after someone whose chase it lost; CH5: a code-run actor stops at its chase range)
  const hunted = hostileBeliefs(view).filter((b) => b.lastKnownZone);
  const recent = hunted.filter((b) => !b.lost)
    .sort((a, b) => (b.lastSeenTurn ?? -1) - (a.lastSeenTurn ?? -1) || a.about.localeCompare(b.about))[0];
  if (recent) {
    const zone = recent.lastKnownZone!;
    if (zone === s.zone) return order(view, 'search', 'fallback', 'search', { target: zone });
    const path = mapPath(view.map, s.zone, zone);
    if (path && (!s.chaseZones || s.chaseZones.includes(path[0]))) return order(view, 'move', 'fallback', `close in on ${zone}`, { target: path[0] });
  }
  // CH7: it lost everyone it was after: back to its routine
  if (!recent && hunted.length) return routineOrder(view);
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
