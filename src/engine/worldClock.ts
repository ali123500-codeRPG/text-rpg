// The world clock moving on (NW11, H12–H15): natural recovery for the minutes that pass, and every NPC not in a fight
// walked on toward where its routine puts it at the new time (catchUp). Called by the turn (resolve.ts) after each turn,
// each step of a stretch or a night, and each leg of a trip.
import { CONFIG } from '../config';
import { routineView } from '../views';
import { desiredState, staying } from '../minds';
import { advanceAging } from '../ruleset/age';
import type { Actor, GameState, Opening } from '../types';
import { openWay } from './barriers';
import { logCode } from './effects';
import { passiveFatigue } from './fatigue';
import { passiveHealing } from './heal';
import { bedGap, freeBeds } from './sleep';
import { frontierPoint, gateAhead, M_EPS, pathM, seeingM, walkLeg, withinM, placeOf } from './position';
import type { Located } from './position';
import { isActive, isAsleep, isEngaged } from './relations';
import { travelSpeed } from './travel';

/** the clock moves on; natural recovery runs for that time (H12–H15) */
export function passTime(state: GameState, minutes: number): void {
  advanceAging(state, minutes, (c, d) => logCode(state, c, d)); // AG16
  passiveHealing(state, minutes);
  passiveFatigue(state, minutes); // FT4/FT7/FT28
}

/** BG-316 (BF102 a): the player sees what happens at a way: a clear line to its point, within the glimpse range of someone
 * walking (SIGHT_M normal) */
function doorSeen(state: GameState, o: Opening, zone: string): boolean {
  const d = seeingM(state, state.player, { zone, pos: { x: o.at.x, y: o.at.y } });
  return d !== null && withinM(d, CONFIG.SIGHT_M.normal![1]);
}

/** NW11: the time a turn took moves everyone on. Each NPC not in a fight goes toward where its routine puts it at the new
 * time, as far as it could walk in that time at the travel pace (travelSpeed), less what its own move already walked:
 * one jump, no Claude calls. It stops at a shut way or at an unbuilt frontier's way (BG-1619: its point, not on entering
 * its title), and a road is walked by its length. Healing
 * already counts minutes. CS11: a way it can open (its key, the bolt's side) it opens and walks through when it is
 * out of the player's sight (BG-316), and leaves it as it was where it can: the key locks it again from either side; a bar slid back from
 * its own side can't be drawn again from the far side, so it stays open. */
export function catchUp(state: GameState, minutes: number, deductWalked = true, onLeg?: (a: Actor, from: Located, metres: number, toward: string) => void): void {
  if (minutes <= 0) return;
  const walked = (deductWalked ? state.scratch?.walked ?? {} : {}) as Record<string, number>;
  const agentRun = new Set((state.scratch?.agentRun as string[] | undefined) ?? []);
  for (const a of [...state.actors].sort((x, y) => x.id.localeCompare(y.id))) {
    const m = a.mind;
    // an NPC whose agent chose its move this turn keeps it: the catch-up is for routine time
    if (!m?.routine || agentRun.has(a.id) || !isActive(a) || isAsleep(a) || isEngaged(state, a) || a.heldBy || m.moraleState || staying(state, a) || a.readied) continue; // AE6: a readied NPC holds its ground
    const d = desiredState(routineView(state, a));
    if (!d) continue;
    // MQ13 a: going to sleep, it walks on to a free bed of its sleep title, its middle, until beside it
    const bed = d.activity === 'sleep' ? freeBeds(state, a, d.zone)[0] : undefined;
    // NW3, BG-1619: heading for unbuilt ground, it walks on to the frontier way's point, where its step in is simulated
    const way = d.frontier ? frontierPoint(state, d.zone, d.frontier) : null;
    const goal: Located = bed ? { zone: d.zone, pos: bed.pos } : way ? { zone: d.zone, pos: way } : { zone: d.zone };
    const away = () => a.zone !== d.zone || (!!bed && bedGap(state, a, bed) > CONFIG.BED_REACH_M) || (!!way && !withinM(pathM(state, a, goal, a), 0));
    if (!away()) continue;
    let left = travelSpeed(state, a) * minutes * 60 - (walked[a.id] ?? 0);
    const start = a.zone;
    for (let i = 0; i < 100 && left > M_EPS && away(); i++) {
      const gate = gateAhead(state, a, d.zone);
      const unseen = !!gate && !doorSeen(state, gate.opening, a.zone); // BG-316 (BF102 a): by the player's line of sight, not titles
      if (gate && (gate.pass !== 'opens' || !unseen)) break; // a way that is not simply open, or opened in view
      const was = gate && { locked: !!gate.b.lock?.locked, drawn: !!gate.b.bar?.drawn };
      if (gate) openWay(gate.b, a, a.zone);
      const from = a.zone, at: Located = placeOf(a);
      const r = walkLeg(state, a, goal, left, 0, a);
      const crossed = r !== null && (r > 0 || a.zone !== from); // BG-151: a doorway underfoot is crossed in 0 m
      if (crossed && onLeg) onLeg(a, at, r, d.zone); // BF2: a leg anyone could see or hear is a walk like any other
      if (gate && was) {
        const through = a.zone === gate.to;
        if (gate.b.lock && was.locked) gate.b.lock.locked = true; // the key turns again on either side
        if (gate.b.bar && was.drawn && !through) gate.b.bar.drawn = true; // still on the bolt's side: slid back again
        if (through) logCode(state, 'catch_up_way', { actorId: a.id, barrier: gate.b.id, from, to: gate.to, ...(was.drawn ? { leftUnbarred: true } : {}) });
      }
      if (!crossed) break;
      left -= r;
    }
    if (a.zone !== start) logCode(state, 'caught_up', { actorId: a.id, from: start, to: a.zone }); // a silent jump (BF2)
  }
}
