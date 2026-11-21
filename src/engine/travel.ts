// Travel on the road (TV1–TV9): a walk along a road, which is one long zone, in one turn. Code walks it in legs of up to
// TRAVEL_LEG_MIN game minutes at the travel speed; every full leg of minutes on a road rolls for an encounter by the road's
// danger, counted across trips (RE1, BG-291), and an encounter's event roll sets what it is (the next scenario's tier). The trip stops on arrival, at an encounter, or at dusk
// (unless the trip set off in the dark: then it presses on, more slowly, with a worse event roll and more encounters).
import { wayTo } from '../plan/where';
import { alongLine, keepInside, pointAlong } from '../plan/geom';
import { CONFIG } from '../config';
import { zoneById, allActors, atLeast, hostile, isActive, isEngaged } from './relations';
import { moveSpeed } from './speed';
import { walkLeg, routeOf, spotOf, distM, frontierPoint, spotPoint, withinM, M_EPS, placeAll, type Located, type Pos } from './position';
export { frontierPoint };
import { eachPerceives, together } from './yield';
import { minutesUntil, now, timeOfDay } from '../time';
import { advanceAging } from '../ruleset/age';
import { logCode } from './effects';
import { passiveHealing } from './heal';
import { passiveFatigue, payTravel } from './fatigue';
import { getLibrary } from '../library';
import { ruleset } from '../ruleset';
import type { Actor, EventRollResult, GameState, Order, Rng, Zone } from '../types';

const T_EPS = 1e-6; // minutes

export type TripStop = 'arrived' | 'nightfall' | 'encounter' | 'met';
export type Trip = { metres: number; minutes: number; legs: number; night: boolean; stop: TripStop; companions: string[]; fromZone: string;
  encounter?: { eventRoll: EventRollResult; at: Pos }; met?: TripMet };
/** RE5: why a trip stopped on the way, and who stopped it (as a rest's stop: contact, someone closing, a change, someone new
 * in the senses, a fight in them) */
export type TripMet = { why: string; by: string[] };
/** RE5: the world clock a trip runs on: how long the next step may be (seconds), a mark taken before each step, and after it
 * (minutes walked) everyone else moving on and the check that would stop a rest */
export type TripWorld<M = unknown> = { stepS(): number; mark(): M; after(minutes: number, mark: M): TripMet | null };

/** PZ9: a road is a title drawn along a line */
export const isRoad = (z: Zone | undefined) => !!z?.line?.length;
/** dusk and night are dark enough to stop a trip (TV5) */
export const darkOut = (t: number) => CONFIG.ROAD_DARK.includes(timeOfDay(t));

/** TV2/SR5: travel speed in m/s: a share of the walking speed (body type, armor, speed factor all count), less in the dark */
export const travelSpeed = (state: GameState, a: Actor, dark = false): number => moveSpeed(state, a).walk * (dark ? CONFIG.TRAVEL_DARK_SPEED_SHARE : CONFIG.TRAVEL_SPEED_SHARE);

/** TV1: travel mode, or null for normal turns. A move with no main action along a route that uses a road, outside a
 * fight, with nobody hostile engaged with the player or perceiving them. The goal is the move's zone, or for a frontier off
 * the road, the road's end (crossing it comes after). */
export function tripGoal(state: GameState, a: Actor, o: Order): { goal: Located; frontier?: string } | null {
  if (a !== state.player || !o.move || o.type !== 'hold' || o.perkMove || o.moveAfter || state.mode === 'tactical' || isEngaged(state, a)) return null;
  if (allActors(state).some((x) => x !== a && isActive(x) && hostile(state, x, a) && atLeast(x.mind?.knowledge?.[a.id]?.status, 'suspicious'))) return null;
  const here = zoneById(state, a.zone);
  const link = here ? wayTo(state, here.id, o.move) : undefined;
  if (link?.frontier) {
    const at = isRoad(here) ? frontierPoint(state, here!.id, o.move) : null;
    return at ? { goal: { zone: here!.id, pos: at }, frontier: o.move } : null;
  }
  const path = routeOf(state, a, { zone: o.move });
  if (!path || ![a.zone, ...path].some((id) => isRoad(zoneById(state, id)))) return null;
  // BG-12: a spot on the way (a road's far end, the north side) is where the trip ends; one that names nothing is no trip
  if (o.moveSpot) {
    const sp = spotPoint(state, o.move, o.moveSpot, a);
    return sp && !sp.toward ? { goal: { zone: o.move, pos: sp.pos } } : null;
  }
  return path.length ? { goal: { zone: o.move } } : null;
}

/** who is on the player's side on the move: active bandmates together with it (YD7), and BF9 anyone following it (the
 * follow routine) who is together with it the same way, seeing each other. A companion warns (D-51 b); see `travellers` for a trip */
export const companions = (state: GameState, a: Actor): Actor[] => state.actors.filter((x) => isActive(x) && x !== a && (together(state, a, x)
  || following(state, a, x)));

/** BF9: x follows (the follow routine) and x and a see each other */
const following = (state: GameState, a: Actor, x: Actor): boolean =>
  getLibrary().routines?.[x.mind?.routine?.id ?? '']?.kind === 'follow' && eachPerceives(state, a, x);

/** TV6 (D-202 b): who travels with the player: only those following it (the follow routine) who see it and are seen by it.
 * Being a bandmate alone does not take anyone along */
export const travellers = (state: GameState, a: Actor): Actor[] => state.actors.filter((x) => isActive(x) && x !== a && following(state, a, x));

/** walks the trip leg by leg, each leg in the world clock's steps (RE5, `world`); the clock moves and natural recovery runs for each */
export function travel(state: GameState, a: Actor, goal: Located, o: Order, rng: Rng, world?: TripWorld<any>): Trip {
  const group = [a, ...travellers(state, a)];
  const fromZone = a.zone;
  const pressOn = darkOut(now(state)); // TV5: setting off in the dark presses on; a trip that reaches dusk stops to ask
  const there = () => (goal.pos ? withinM(distM(state, a, goal), 0) : a.zone === goal.zone);
  const trip: Trip = { metres: 0, minutes: 0, legs: 0, night: false, stop: 'arrived', companions: group.slice(1).map((x) => x.id), fromZone };
  let last: Pos | undefined;
  while (!there() && trip.legs < CONFIG.TRAVEL_MAX_LEGS) {
    const t = now(state);
    const dark = darkOut(t);
    if (dark && !pressOn) { trip.stop = 'nightfall'; break; }
    if (dark) trip.night = true;
    const speed = Math.min(...group.map((x) => travelSpeed(state, x, dark))) * 60; // m per minute: the slowest sets it
    if (speed <= 0) break;
    // RE1: a leg ends where the road minutes carried from earlier trips make a full leg, so the roll falls there
    const due = CONFIG.TRAVEL_LEG_MIN - (a.roadMin ?? 0);
    let minutes = due > T_EPS ? Math.min(CONFIG.TRAVEL_LEG_MIN, due) : CONFIG.TRAVEL_LEG_MIN;
    if (!dark) minutes = Math.min(minutes, minutesUntil(t, 'dusk'));
    // RE5: the leg is walked in the world clock's steps (as a rest or a walk runs): each step the clock moves on, everyone
    // else moves toward their routines, and what would stop a rest stops the trip
    let legLeft = minutes, walked = 0, onRoad = 0;
    while (legLeft > T_EPS && !there() && !trip.met) {
      const sm = world ? Math.min(legLeft, world.stepS() / 60) : legLeft;
      const mark = world?.mark();
      let left = speed * sm, w0 = walked;
      for (let n = 0; n < 100 && left > M_EPS && !there(); n++) {
        const before = spotOf(state, a).pos;
        const zone = a.zone;
        const w = walkLeg(state, a, goal, left, 0);
        if (w === null || (!w && a.zone === zone)) break; // BG-170: a 0 m doorway crossing goes on
        if (before) last = before;
        if (w && (isRoad(zoneById(state, zone)) || isRoad(zoneById(state, a.zone)))) onRoad += w;
        left -= w; walked += w;
      }
      const m = (walked - w0) / speed;
      if (m <= 0) break;
      legLeft -= m;
      advanceAging(state, m, (c, d) => logCode(state, c, d)); // AG16
      passiveHealing(state, m);
      passiveFatigue(state, m); // FT4/FT28
      for (const x of group) payTravel(state, x, m); // SR5
      for (const c of group.slice(1)) { c.zone = a.zone; c.placeId = a.placeId; c.pos = { ...a.pos }; c.floor = a.floor; } // they walk beside the player
      const met = world && mark ? world.after(m, mark) : null;
      if (met) { trip.met = met; trip.stop = 'met'; }
    }
    if (walked <= 0) break;
    minutes = walked / speed;
    trip.metres += walked; trip.minutes += minutes; trip.legs += 1;
    // TV4 + RE1 (BG-291): minutes on a road count up across trips; each full leg of them rolls once, by the danger of the
    // road the player is on then (more in the dark), and the count starts again. A leg filled off the road waits for one.
    a.roadMin = Math.min(CONFIG.TRAVEL_LEG_MIN, (a.roadMin ?? 0) + onRoad / speed);
    const road = zoneById(state, a.zone);
    if (trip.met) break; // RE5: met on the way: the trip stops there, the road minutes kept for the next
    if (a.roadMin >= CONFIG.TRAVEL_LEG_MIN - T_EPS && isRoad(road)) {
      a.roadMin = 0;
      const pct = CONFIG.ROAD_ENCOUNTER_PCT[road!.danger ?? 'quiet'] * (CONFIG.TRAVEL_LEG_MIN / 60) * (dark ? CONFIG.NIGHT_ENCOUNTER_MULT : 1);
      if (rng.d100() <= pct) {
        const extra: EventRollResult['modifiers'] = dark ? [{ source: 'night travel', type: 'situational', value: CONFIG.NIGHT_TRAVEL_EVENT_MOD }] : [];
        const eventRoll = ruleset.eventRoll(a, state, rng, extra);
        trip.encounter = { eventRoll, at: ahead(road!, spotOf(state, a).pos!, last) };
        trip.stop = 'encounter';
        break;
      }
    }
  }
  for (const c of group.slice(1)) { c.zone = a.zone; c.placeId = a.placeId; }
  if (group.length > 1) placeAll(state, group.slice(1).map((c) => c.id)); // GSM-51: placed beside the player at once (a fresh spot)
  return trip;
}

/** RE6: where an encounter stands: where it is first glimpsed (ENCOUNTER_VISIBILITY's glimpse range) on along the road from
 * `p`, the way the player was walking, kept on the road */
function ahead(z: Zone, p: Pos, from?: Pos): Pos {
  const m = CONFIG.SIGHT_M[CONFIG.ENCOUNTER_VISIBILITY]?.[1] ?? 0;
  if (z.line?.length) { // PZ9: on along the road's line, the way the player walks it
    const here = alongLine(z.line, p).m, back = from ? alongLine(z.line, from).m : here;
    return pointAlong(z.line, here + (here >= back ? m : -m));
  }
  const dx = from ? p.x - from.x : 0, dy = from ? p.y - from.y : 0, len = Math.hypot(dx, dy) || 1;
  return keepInside({ x: p.x + (dx / len) * m, y: p.y + (dy / len) * m }, z.outline, 0);
}

