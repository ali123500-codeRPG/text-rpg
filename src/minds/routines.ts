// Code minds: routines (desired state) and the fallback combat list. They read only ActorView, never GameState.
import type { ActorView, MapZone, Order, OrderTemplate, Routine, Rng } from '../types';
import { GRADES } from '../types';
import { CONFIG } from '../config';
import { PK } from '../library/perkIds';
import { AWARENESS, HEALTH_LEVELS, type TimeOfDay } from '../scales';
import { FIGHT_RULES } from '../library/fightRules';
import { FX } from '../library/tableIds';
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

export type Stop = { slot: string; zone: string; minutes: number; activity: string; unbound?: true };

/** NW10: a routine's steps at a time of day: its own for that time, else its steps for any time */
export const stepsAt = (r: Routine, dayPart?: TimeOfDay) => (dayPart && r.times?.find((t) => t.at.includes(dayPart))?.steps) || r.steps;

/** a route slot expands to one stop per bound zone; an unbound slot gives no stop, except a sleep step: BF68, with nowhere
 * given to sleep it sleeps `here` (where it stands; the stop says unbound, so code files the gap). NW10: each stop lasts
 * game minutes. */
export function expandSteps(r: Routine, slots: Record<string, string | string[]>, dayPart?: TimeOfDay, here?: string): Stop[] {
  const out: Stop[] = [];
  for (const st of stepsAt(r, dayPart)) {
    const b = slots[st.slot];
    const zones = b === undefined ? [] : Array.isArray(b) ? b : [b];
    const minutes = CONFIG.DURATIONS[st.duration];
    if (!zones.length && st.activity === 'sleep' && here) out.push({ slot: st.slot, zone: here, minutes, activity: st.activity, unbound: true });
    for (const zone of zones) out.push({ slot: st.slot, zone, minutes, activity: st.activity });
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

export function desiredState(view: ActorView): { zone: string; activity: string; unbound?: true } | null {
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
  const stops = expandSteps(r, view.self.slots, cur.dayPart, view.self.zone);
  if (!stops.length) return null;
  const total = stops.reduce((n, s) => n + s.minutes, 0);
  let t = cur.elapsed ?? 0;
  if (r.loop) t = ((t % total) + total) % total;
  else if (t >= total) return { zone: stops[stops.length - 1].zone, activity: stops[stops.length - 1].activity };
  t = Math.max(0, t);
  for (const s of stops) {
    if (t < s.minutes) return { zone: s.zone, activity: s.activity, ...(s.unbound ? { unbound: true as const } : {}) };
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
/** BF37/BF79: what a broken nerve blocks: any attack, grab, filch or perk move, except the perk moves in
 * NERVE_ALLOWED_PERK_MOVES (Battle Cry: a broken one can still roar; Play Dead), and any walk toward a foe (the walk itself is judged
 * where it runs: engine/nerve.ts walksAway). A walk or run away is allowed. Talking, begging, persuading, lying, yielding,
 * giving, using an item, picking up and unlocking or opening a door or container within reach still work. At Cowering (below
 * Broken) the walks go too (NERVE_MOVES). */
export const NERVE_BLOCKED: readonly string[] = ['attack', 'filch', 'restrain'];
/** BF79: the order types that are only a walk: allowed while broken (away only), blocked at Cowering */
export const NERVE_MOVES: readonly string[] = ['move', 'flee'];
export const NERVE_ALLOWED_PERK_MOVES: readonly string[] = [PK.battle_cry, PK.play_dead]; // TC58 a: a broken one can still play dead
const NOTHING_CHOSEN: readonly string[] = ['idle', 'hold', 'wait'];
/** BF37: the cowering order: no move and no action, only words */
export const cowerOrder = (actorId: string, source: Order['source']): Order => ({ actorId, type: 'idle', target: null, skill: null, intent: 'cower', source, activity: 'cowering' });
/** what an order keeps beside a cower or a flee: its words, gear, a way within reach, the trigger it answers */
const keptBeside = (o: Order): Partial<Order> => ({ ...(o.line ? { line: o.line } : {}), ...(o.addressees ? { addressees: o.addressees } : {}), ...(o.gear?.length ? { gear: o.gear } : {}), ...(o.way ? { way: o.way } : {}), ...(o.triggerId ? { triggerId: o.triggerId } : {}) });
/** BF37/BF79: the order a broken nerve leaves: the blocked parts taken away (an attack, a perk move; at Cowering
 * the walk too), the rest kept (its words, gear, an allowed action, and a walk, which only goes ahead if it leads away);
 * nothing allowed left, it cowers. `blocked` says whether anything was taken. */
export function nerveHolds(o: Order, cowering = false): { order: Order; blocked: boolean } {
  const { move: _m, moveAfter: _ma, moveSpot: _ms, jump: _j, perkMove: _pm, ...rest } = o;
  const cry = o.perkMove && NERVE_ALLOWED_PERK_MOVES.includes(o.perkMove.perk) ? { perkMove: o.perkMove } : {};
  const stops = cowering ? [...NERVE_BLOCKED, ...NERVE_MOVES] : NERVE_BLOCKED;
  // an attack's or a grab's own walk closes in on its target, so it goes with the deed
  const walk: Partial<Order> = !stops.includes(o.type) && !cowering && o.move ? { move: o.move, ...(o.moveAfter ? { moveAfter: o.moveAfter } : {}), ...(o.moveSpot ? { moveSpot: o.moveSpot } : {}), ...(o.jump ? { jump: o.jump } : {}) } : {};
  const kept: Order = { ...rest, ...cry, ...walk };
  const blocked = (!!o.move && !walk.move) || (!!o.perkMove && !cry.perkMove) || stops.includes(o.type);
  if (!stops.includes(o.type) && !NOTHING_CHOSEN.includes(o.type)) return { order: kept, blocked };
  return { order: { ...cowerOrder(o.actorId, o.source), ...cry, ...walk, ...keptBeside(kept) }, blocked };
}

/** whom a broken actor runs from: those it is hostile to, and those it yielded to (Q4) */
const fleeFrom = (view: ActorView) => view.beliefs.filter((b) => (b.hostile || b.stance === 'yielded') && b.active && b.status !== 'unaware');

/** BF79: a broken NPC with nothing allowed left flees: one link toward its exit or refuge slot, else into a linked zone
 * farther from the nearest foe it fears (never a way into a foe's zone); with no way away (or already at its exit or
 * refuge) it cowers. At Cowering it
 * cowers. Whether the walk really leads away is judged where it runs (engine/nerve.ts walksAway): NPCs stay in real zones. */
export function fleeOrder(view: ActorView, source: Order['source']): Order {
  const cower = () => cowerOrder(view.self.id, source);
  if (view.self.cowering) return cower();
  // TC36 c Fall Back on Me: it runs to the owner instead of away
  const back = view.self.fallBackTo;
  if (back) return order(view, 'idle', source, `fall back on ${back.id}`, { move: back.zone, moveSpot: { near: back.id } });
  const here = view.self.zone;
  const threats = fleeFrom(view).filter((b) => b.lastKnownZone).map((b) => b.lastKnownZone!);
  // toward its exit or refuge, unless that way runs into a foe's zone
  for (const key of ['exit', 'refuge']) {
    const b = view.self.slots[key];
    const zone = Array.isArray(b) ? b[0] : b;
    if (!zone) continue;
    if (zone === here) return cower();
    const path = mapPath(view.map, here, zone);
    if (path?.length && !threats.includes(path[0])) return order(view, 'flee', source, 'flee', { target: path[0] });
  }
  const dist = (a: string, b: string) => mapPath(view.map, a, b)?.length ?? Infinity;
  if (!threats.length) return cower();
  const threat = threats.reduce((best, z) => (dist(here, z) < dist(here, best) ? z : best));
  const links = view.map.find((z) => z.id === here)?.links ?? [];
  let best: string | null = null;
  let bestD = dist(here, threat);
  for (const l of links) {
    if (l.frontier || l.drop || l.shut || !view.map.some((z) => z.id === l.to)) continue;
    const d = dist(l.to, threat);
    if (d > bestD) [best, bestD] = [l.to, d];
  }
  return best ? order(view, 'flee', source, 'flee', { target: best }) : cower();
}

/** BF79: what a broken NPC does with its order: nerveHolds; with nothing allowed left and no walk away, it flees (fleeOrder),
 * keeping its words, gear and a way within reach */
export function brokenHolds(view: ActorView, o: Order): Order {
  // TC58/TC59 a: dropping to play dead, or lying still while it does, is a still hold a broken nerve keeps
  if (o.type === 'hold' && !o.move && (o.perkMove?.perk === PK.play_dead || (view.self.playingDead && !o.perkMove))) return o;
  const { order: held } = nerveHolds(o, !!view.self.cowering);
  if (held.intent !== 'cower' || held.move) return held;
  const run = fleeOrder(view, o.source);
  return { ...run, ...keptBeside(held), ...(held.perkMove ? { perkMove: held.perkMove } : {}) };
}

/** a broken actor no one asked anything of flees (BF79; cowers when cornered or at Cowering); one that surrendered holds where it is */
export function brokenOrder(view: ActorView): Order {
  return view.self.surrendered ? order(view, 'hold', 'broken', 'hold') : fleeOrder(view, 'broken');
}

/** TC23 a S2: no foe in sight now, so it believes none sees it: it sneaks one way toward the foe it would close in on
 * (the same pick and chase limit as close in), so its first blow can come from hiding */
function stalkOrder(view: ActorView, rule: string): Order | null {
  const s = view.self, seen = new Set((view.seen ?? []).map((x) => x.id));
  const hunted = hostileBeliefs(view).filter((b) => b.hostile && b.lastKnownZone); // a spar is never stalked
  if (hunted.some((b) => seen.has(b.about))) return null;
  const recent = hunted.filter((b) => !b.lost).sort((a, b) => (b.lastSeenTurn ?? -1) - (a.lastSeenTurn ?? -1) || a.about.localeCompare(b.about))[0];
  if (!recent || recent.lastKnownZone === s.zone) return null;
  const path = mapPath(view.map, s.zone, recent.lastKnownZone!);
  return path && (!s.chaseZones || s.chaseZones.includes(path[0])) ? order(view, 'sneak', 'fallback', `steal up on ${recent.about}`, { target: path[0], rule }) : null;
}

/** D-17 (TC17, TC23): the first FIGHT_RULES row the NPC may use whose situation holds, as an order; null when none fires.
 * B4 counts Wounded or worse as hurt. */
export function tacticsOrder(view: ActorView): Order | null {
  const t = view.tactics;
  if (!t) return null;
  const s = view.self;
  const strike = (target: string, rule: string) => order(view, 'attack', 'fallback', 'attack', { target, skill: s.attackSkill, targetPart: null, aimed: false, rule });
  // S3 (TC50 a): a feint under way comes before every other row: turn on the lone believer, else keep running
  if (t.turnOn) return strike(t.turnOn, FX.feigned_flight);
  if (t.feint === 'run') return { ...fleeOrder(view, 'fallback'), rule: FX.feigned_flight };
  for (const r of FIGHT_RULES) {
    if (!t.rows.includes(r.id)) continue;
    if (r.id === FX.call_help && t.outnumbered && !t.calledHelp) return order(view, 'call_help', 'fallback', 'call for help', { rule: r.id });
    if (r.id === FX.gang_up && t.allyFoe) return strike(t.allyFoe, r.id);
    if (r.id === FX.back_off && t.outnumbered && t.freeAlly && HEALTH_LEVELS.pos(s.health) >= HEALTH_LEVELS.pos('wounded'))
      return order(view, 'idle', 'fallback', `back off toward ${t.freeAlly.id}`, { move: t.freeAlly.zone, moveSpot: { near: t.freeAlly.id }, rule: r.id });
    if (r.id === FX.draw_into_pack && t.drawTo) return order(view, 'idle', 'fallback', `fall back toward ${t.drawTo.id}`, { move: t.drawTo.zone, moveSpot: { near: t.drawTo.id }, rule: r.id });
    if (r.id === FX.strike_from_hiding) { const o = stalkOrder(view, r.id); if (o) return o; }
    const walk = r.id === FX.out_of_sight ? t.outOfSight : r.id === FX.into_cover ? t.intoCover : r.id === FX.into_dark ? t.intoDark : undefined;
    if (walk) return order(view, 'idle', 'fallback', r.name.toLowerCase(), { move: walk.zone, moveSpot: { near: walk.via }, rule: r.id });
    if (r.id === FX.finish_hurt && t.hurtFoe) return strike(t.hurtFoe, r.id);
    if (r.id === FX.feigned_flight && t.feint === 'start') return { ...fleeOrder(view, 'fallback'), rule: r.id };
  }
  return null;
}

/** the code-run fight list: broken first, then the NPC's skilled rows (D-17, tacticsOrder), then attack, close in,
 * search and hold. B3 Ready the shield goes beside whatever it chose: shot at, it draws the stowed shield too (a free gear
 * op before the action) */
export function fallbackOrder(view: ActorView, rng: Rng): Order {
  const o = fightList(view, rng);
  const sh = view.tactics?.readyShield;
  return sh && !view.self.broken && !view.self.surrendered ? { ...o, gear: [...(o.gear ?? []), { op: 'draw', item: sh }] } : o;
}

function fightList(view: ActorView, rng: Rng): Order {
  const s = view.self;
  // 1. Broken: flee, or cower when cornered (BF79); surrendered: hold
  if (s.surrendered) return order(view, 'hold', 'fallback', 'hold');
  if (s.broken) return fleeOrder(view, 'fallback');
  // ZR12: a code-run pursuer at the end of its near chase range turns back
  if (s.atChaseLine && hostileBeliefs(view).some((b) => !b.lost)) return routineOrder(view);
  const row = tacticsOrder(view);
  if (row) return row;
  // 2. Attack
  // BG-306: the foes it knows of that a move and a blow reach this turn, else the foes it sees (an attack closes in and runs
  // on, BG-255); never "in my zone"
  const foes = view.beliefs.filter((b) => (b.hostile || b.sparring) && b.active && !b.lost && AWARENESS.pos(b.status) >= AWARENESS.pos('aware'));
  const near = foes.filter((b) => s.withinStrike?.includes(b.about));
  const here = (near.length ? near : foes.filter((b) => view.seen?.some((x) => x.id === b.about))).map((b) => b.about).sort();
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
  // BF96 a: a beat may carry the difficulty of a graded act and its fall; a word off the grade scale or a fall that is not
  // a distance is dropped here, so the act rolls at Moderate and is flagged (grade_gap) as with no grade at all
  const { grade, fall, ...rest } = tpl;
  return {
    ...rest, ...(grade && (GRADES as readonly string[]).includes(grade) ? { grade } : {}), ...(typeof fall === 'number' && fall > 0 ? { fall } : {}),
    actorId: view.self.id, target, source: ctx.source, ...(ctx.triggerId ? { triggerId: ctx.triggerId } : {}),
  };
}
