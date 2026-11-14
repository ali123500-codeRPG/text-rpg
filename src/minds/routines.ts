// Code minds: routines (desired state) and the fallback combat list. They read only ActorView, never GameState.
import type { ActorView, MapZone, Order, OrderTemplate, Routine, Rng } from '../types';
import { CONFIG } from '../config';
import { AWARENESS, type TimeOfDay } from '../scales';
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

export type Stop = { slot: string; zone: string; minutes: number; activity: string };

/** NW10: a routine's steps at a time of day: its own for that time, else its steps for any time */
export const stepsAt = (r: Routine, dayPart?: TimeOfDay) => (dayPart && r.times?.find((t) => t.at.includes(dayPart))?.steps) || r.steps;

/** a route slot expands to one stop per bound zone; an unbound slot gives no stop. NW10: each stop lasts game minutes. */
export function expandSteps(r: Routine, slots: Record<string, string | string[]>, dayPart?: TimeOfDay): Stop[] {
  const out: Stop[] = [];
  for (const st of stepsAt(r, dayPart)) {
    const b = slots[st.slot];
    const zones = b === undefined ? [] : Array.isArray(b) ? b : [b];
    for (const zone of zones) out.push({ slot: st.slot, zone, minutes: CONFIG.DURATIONS[st.duration], activity: st.activity });
  }
  return out;
}

/** slots a routine reads (steps and onAlert $slot targets); 'here' is code-written and left out. */
export function slotsRead(r: Routine): string[] {
  const s = new Set([...r.steps, ...(r.times ?? []).flatMap((t) => t.steps)].map((st) => st.slot));
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
    // follow with no belief about the player: it stays where it is
    return { zone: b?.lastKnownZone ?? view.self.zone, activity: r.activity ?? 'rest' };
  }
  if (r.kind === 'head') {
    const dest = view.self.slots.dest;
    const g = headGoal(view, (Array.isArray(dest) ? dest[0] : dest) ?? view.self.zone);
    // a destination gone from its map (or never bound): it stays where it is until code sends it back
    return { zone: g?.zone ?? view.self.zone, activity: r.activity ?? 'walk' };
  }
  if (r.kind === 'wait') {
    const here = view.self.slots.here;
    // a wait routine with 'here' unbound (never switched to): it stays in the current zone
    return { zone: (Array.isArray(here) ? here[0] : here) ?? view.self.zone, activity: r.activity ?? 'rest' };
  }
  // NW10: the steps for the time of day now, run on the clock: minutes since the routine started
  const stops = expandSteps(r, view.self.slots, cur.dayPart);
  if (!stops.length) return null;
  const total = stops.reduce((n, s) => n + s.minutes, 0);
  let t = cur.elapsed ?? 0;
  if (r.loop) t = ((t % total) + total) % total;
  else if (t >= total) return { zone: stops[stops.length - 1].zone, activity: stops[stops.length - 1].activity };
  t = Math.max(0, t);
  for (const s of stops) {
    if (t < s.minutes) return { zone: s.zone, activity: s.activity };
    t -= s.minutes;
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

/** marks a routine order whose desired zone has no path: the NPC idles where it stands, and the engine logs
 * routine_unreachable once for it (CS22, noteUnreachable in src/engine/resolve.ts). */
export const UNREACHABLE = 'routine_unreachable';

export function routineOrder(view: ActorView): Order {
  const d = desiredState(view);
  if (!d) return order(view, 'hold', 'routine', 'hold');
  const into = headFrontier(view);
  if (into) return order(view, 'move', 'routine', `walk into ${into}`, { target: into, activity: d.activity });
  // BF35: a follower in the player's zone keeps after them at its own distance (melee, or at range with a ranged weapon)
  if (d.zone === view.self.zone && getRoutine(view.self.routine!.id).kind === 'follow' && view.beliefs.some((b) => b.about === 'player' && b.lastKnownZone === d.zone))
    return order(view, 'idle', 'routine', d.activity, { activity: d.activity, move: d.zone, moveSpot: { near: 'player', follow: true } });
  if (d.zone === view.self.zone) return order(view, d.activity === 'search' ? 'search' : 'idle', 'routine', d.activity, { activity: d.activity }); // SE16
  const path = mapPath(view.map, view.self.zone, d.zone);
  if (!path) return order(view, 'idle', 'routine', UNREACHABLE, { activity: d.activity });
  return order(view, 'move', 'routine', `walk toward ${d.zone}`, { target: path[0], activity: d.activity });
}

/** those it fights: hostile, or a spar opponent (SP1) */
function hostileBeliefs(view: ActorView) {
  return view.beliefs.filter((b) => (b.hostile || b.sparring) && b.active && b.status !== 'unaware');
}
/** BF37: what a broken nerve blocks, for now: any walk or run (fleeing too), and any attack, grab, filch or perk move (Battle
 * Cry). Talking, begging, persuading, lying, yielding, giving, using an item, picking up and unlocking or opening a door or
 * container within reach still work. An actor broken with nothing allowed to do cowers where it stands. */
export const NERVE_BLOCKED: readonly string[] = ['attack', 'move', 'flee', 'filch', 'restrain'];
const NOTHING_CHOSEN: readonly string[] = ['idle', 'hold', 'wait'];
/** BF37: the cowering order: no move and no action, only words */
export const cowerOrder = (actorId: string, source: Order['source']): Order => ({ actorId, type: 'idle', target: null, skill: null, intent: 'cower', source, activity: 'cowering' });
/** BF37: the order a broken nerve leaves: the blocked parts taken away (the move, an attack, a perk move), the rest kept
 * (its words, gear and an allowed action); nothing allowed left, it cowers. `blocked` says whether anything was taken. */
export function nerveHolds(o: Order): { order: Order; blocked: boolean } {
  const { move: _m, moveAfter: _ma, moveSpot: _ms, jump: _j, vanish: _v, perkMove: _pm, pace: _p, ...kept } = o;
  const blocked = !!o.move || !!o.perkMove || !!o.vanish || NERVE_BLOCKED.includes(o.type);
  if (!NERVE_BLOCKED.includes(o.type) && !NOTHING_CHOSEN.includes(o.type)) return { order: kept, blocked };
  const cower = cowerOrder(o.actorId, o.source);
  return { order: { ...cower, ...(kept.line ? { line: kept.line } : {}), ...(kept.addressees ? { addressees: kept.addressees } : {}), ...(kept.gear?.length ? { gear: kept.gear } : {}), ...(kept.way ? { way: kept.way } : {}), ...(kept.triggerId ? { triggerId: kept.triggerId } : {}) }, blocked };
}

/** a broken actor no one asked anything of cowers (BF37); one that surrendered holds where it is */
export function brokenOrder(view: ActorView): Order {
  return view.self.surrendered ? order(view, 'hold', 'broken', 'hold') : cowerOrder(view.self.id, 'broken');
}

export function fallbackOrder(view: ActorView, rng: Rng): Order {
  const s = view.self;
  // 1. Broken: cower (BF37); surrendered: hold
  if (s.surrendered) return order(view, 'hold', 'fallback', 'hold');
  if (s.broken) return cowerOrder(s.id, 'fallback');
  // ZR12: a code-run pursuer at the end of its near chase range turns back
  if (s.atChaseLine && hostileBeliefs(view).some((b) => !b.lost)) return routineOrder(view);
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
