// Travel on the road (TV1–TV9): a walk along a road, which is one long zone, in one turn. Code walks it in legs of up to
// TRAVEL_LEG_MIN game minutes at the travel pace; each leg on a road rolls for an encounter by the road's danger, and an
// encounter's event roll sets what it is (the next scene's tier). The trip stops on arrival, at an encounter, or at dusk
// (unless the trip set off in the dark: then it presses on, at a slow pace, with a worse event roll and more encounters).
import { CONFIG } from '../config';
import { FN } from '../library/functionIds';
import { zoneById, allActors, atLeast, hostile, isActive, isEngaged, shortestPath } from './relations';
import { moveSpeed } from './speed';
import { walkLeg, spotOf, distM, frontierPoint, spotPoint, type Located, type Pos } from './position';
export { frontierPoint };
import { together } from './yield';
import { advanceClock, minutesUntil, now, timeOfDay } from '../time';
import { passiveHealing } from './heal';
import { getLibrary } from '../library';
import { TIERS, type TravelPaceKey } from '../scales';
import { fnRoller, ruleset, situational } from '../ruleset';
import type { Actor, EventRollResult, GameState, Mod, Order, Rng, Zone } from '../types';

export type TripStop = 'arrived' | 'nightfall' | 'encounter';
export type Trip = { metres: number; minutes: number; legs: number; pace: TravelPaceKey; night: boolean; stop: TripStop; companions: string[]; fromZone: string;
  encounter?: { eventRoll: EventRollResult; noticed: boolean; at: Pos } };

export const isRoad = (z: Zone | undefined) => !!z?.kind && !!getLibrary().zoneKinds?.[z.kind]?.road;
/** dusk and night are dark enough to stop a trip (TV5) */
export const darkOut = (t: number) => ['dusk', 'night'].includes(timeOfDay(t));

/** TV2: travel speed in m/s at a pace: a share of the walking speed (body type, armor, speed factor all count) */
export const travelSpeed = (state: GameState, a: Actor, pace: TravelPaceKey): number => moveSpeed(state, a).walk * CONFIG.TRAVEL_PACE_SHARE[pace];

/** TV1: travel mode, or null for normal turns. A move with no main action along a route that uses a road, outside a
 * fight, with nobody hostile engaged with the player or perceiving them. The goal is the move's zone, or for a frontier off
 * the road, the road's end (crossing it comes after). */
export function tripGoal(state: GameState, a: Actor, o: Order): { goal: Located; frontier?: string } | null {
  if (a !== state.player || !o.move || o.type !== 'hold' || o.perkMove || o.moveAfter || state.mode === 'tactical' || isEngaged(state, a)) return null;
  if (allActors(state).some((x) => x !== a && isActive(x) && hostile(state, x, a) && atLeast(x.mind?.knowledge?.[a.id]?.status, 'suspicious'))) return null;
  const here = zoneById(state, a.zone);
  const link = here?.links.find((l) => l.to === o.move);
  if (link?.frontier) {
    if (!isRoad(here) || !here!.rect) return null;
    return { goal: { zone: here!.id, pos: frontierPoint(here!, link.label, spotOf(state, a).pos ?? { x: here!.rect.x, y: here!.rect.y }) }, frontier: o.move };
  }
  const path = shortestPath(state, a.zone, o.move);
  if (!path || ![a.zone, ...path].some((id) => isRoad(zoneById(state, id)))) return null;
  // BG-12: a spot on the way (a road's far end, the north side) is where the trip ends; one that names nothing is no trip
  if (o.moveSpot) {
    const sp = spotPoint(state, o.move, o.moveSpot, a);
    return sp && !sp.toward ? { goal: { zone: o.move, pos: sp.pos } } : null;
  }
  return path.length ? { goal: { zone: o.move } } : null;
}

/** who travels with the player: active bandmates together with it (TV6, as YD7) */
export const companions = (state: GameState, a: Actor): Actor[] => state.actors.filter((x) => isActive(x) && together(state, a, x));

/** TV8: one noticing roll: the sight function at the pace's modifier and the light where the player is */
function notices(state: GameState, a: Actor, pace: TravelPaceKey, rng: Rng): boolean {
  const skill = fnRoller(state, a, FN.sight);
  const pm = CONFIG.TRAVEL_NOTICE_MOD[pace];
  const modifiers: Mod[] = [...(pm ? [{ source: 'travel pace', type: 'situational' as const, value: pm }] : []), ...situational(state, skill, { light: zoneById(state, a.zone), actor: a }).modifiers];
  const r = ruleset.roll({ actorId: a.id, skill, modifiers, tierShifts: [], fn: FN.sight }, state, rng);
  const passed = TIERS.pos(r.tier) >= TIERS.pos('success');
  ruleset.recordUse(a, r.skill, { actorId: a.id, skill: r.skill, target: CONFIG.DIFFICULTY.moderate, passed, modifiers }, state);
  return passed;
}

/** walks the trip leg by leg; the clock moves and natural recovery runs for each leg */
export function travel(state: GameState, a: Actor, goal: Located, o: Order, rng: Rng): Trip {
  const group = [a, ...companions(state, a)];
  const fromZone = a.zone;
  const pressOn = darkOut(now(state)); // TV5: setting off in the dark presses on; a trip that reaches dusk stops to ask
  const there = () => (goal.pos ? distM(state, a, goal) <= 0.01 : a.zone === goal.zone);
  const trip: Trip = { metres: 0, minutes: 0, legs: 0, pace: o.pace ?? 'normal', night: false, stop: 'arrived', companions: group.slice(1).map((x) => x.id), fromZone };
  let last: Pos | undefined;
  while (!there() && trip.legs < CONFIG.TRAVEL_MAX_LEGS) {
    const t = now(state);
    const dark = darkOut(t);
    if (dark && !pressOn) { trip.stop = 'nightfall'; break; }
    const pace: TravelPaceKey = dark ? 'slow' : trip.pace;
    if (dark) trip.night = true;
    const speed = Math.min(...group.map((x) => travelSpeed(state, x, pace))) * 60; // m per minute: the slowest sets it
    if (speed <= 0) break;
    let minutes = CONFIG.TRAVEL_LEG_MIN;
    if (!dark) minutes = Math.min(minutes, minutesUntil(t, 'dusk'));
    let left = speed * minutes, walked = 0;
    for (let n = 0; n < 100 && left > 0.01 && !there(); n++) {
      const before = spotOf(state, a).pos;
      const w = walkLeg(state, a, goal, left, 0, true);
      if (!w) break;
      if (before) last = before;
      left -= w; walked += w;
    }
    if (walked <= 0) break;
    minutes = walked / speed;
    trip.metres += walked; trip.minutes += minutes; trip.legs += 1;
    advanceClock(state, minutes);
    passiveHealing(state, minutes);
    // TV4: on a road, a chance per hour by its danger (more in the dark) that something meets you here
    const road = zoneById(state, a.zone);
    if (isRoad(road) && !there()) {
      const pct = CONFIG.ROAD_ENCOUNTER_PCT[road!.danger ?? 'quiet'] * (minutes / 60) * (dark ? CONFIG.NIGHT_ENCOUNTER_MULT : 1);
      if (rng.d100() <= pct) {
        const extra: EventRollResult['modifiers'] = dark ? [{ source: 'night travel', type: 'situational', value: CONFIG.NIGHT_TRAVEL_EVENT_MOD }] : [];
        const eventRoll = ruleset.eventRoll(a, state, rng, extra);
        trip.encounter = { eventRoll, noticed: notices(state, a, pace, rng), at: ahead(road!, spotOf(state, a).pos!, last) };
        trip.stop = 'encounter';
        break;
      }
    }
  }
  for (const c of group.slice(1)) { c.zone = a.zone; c.placeId = a.placeId; delete c.pos; } // placed beside the player next
  return trip;
}

/** where an encounter stands: ENCOUNTER_M on along the road from `p`, the way the player was walking, kept on the road */
function ahead(z: Zone, p: Pos, from?: Pos): Pos {
  const r = z.rect!;
  const dx = from ? p.x - from.x : 0, dy = from ? p.y - from.y : 0, len = Math.hypot(dx, dy) || 1;
  const q = { x: p.x + (dx / len) * CONFIG.ENCOUNTER_M, y: p.y + (dy / len) * CONFIG.ENCOUNTER_M };
  return { x: Math.max(r.x - r.w / 2, Math.min(r.x + r.w / 2, q.x)), y: Math.max(r.y - r.d / 2, Math.min(r.y + r.d / 2, q.y)) };
}

