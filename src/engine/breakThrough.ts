// BW8-BW26: breaking through a wall or a barrier on a way, in play (spec "Breaking walls and barriers"). The order break
// names the title to break through to (the way's barrier there, else the wall toward it) or a wall of the breaker's title
// by id. The work stays on the thing broken as shares of the whole (Barrier.wear, Wall.dents): each breaker's seconds
// count at their own speed (src/ruleset/breaking.ts), so helpers add their rates (BW13 a). Halfway it is Crippled, done
// it is Destroyed (BW11 a): a barrier takes the state, a wall gets a crack, then a hole (src/plan/holes.ts). A material
// that regrows loses the work after CONFIG.REGROW_S with nobody at it (BW9 b). No roll and no skill learned (BW23 a).
import type { Actor, Barrier, GameState, Opening, Pt, TierRoll, Wall, WallDent, Zone } from '../types';
import { goalPoint, pointAt, type Located } from './position';
import { passage } from './barriers';
import { walksThrough } from '../ruleset/breaking';
import { crossings } from '../plan/line';
import { walkPath } from '../plan/path';
import { wallKind } from '../plan/walls';
import { zoneAt } from '../plan/where';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { TIERS } from '../scales';
import { barrierStuff, breakSeconds, breakStrength, breakTool, wallStuff, type Stuff } from '../ruleset/breaking';
import { tierOf } from '../ruleset';
import { barrierOn } from './barriers';
import { breakInside } from './breakage';
import { zoneById } from './relations';
import { secondsSince } from '../time';
import { dist, lerp, toSegment } from '../plan/geom';
import { middle, openingById, wayTo } from '../plan/where';
import { cutHole, holeSpot, wallsAround } from '../plan/holes';
import { planChanged } from '../plan/stamp';
import type { Rng } from '../types';

/** what a break order works on: a barrier on the way to `to`, or a spot on a wall of the breaker's title (`from`), with
 * the title behind it (`to`; none: unbuilt ground). A fresh dent is not on the wall until work is put into it. */
export type BreakJob =
  | { kind: 'barrier'; b: Barrier; opening: Opening; stuff: Stuff; to: string }
  | { kind: 'wall'; w: Wall; dent: WallDent; fresh: boolean; from: Zone; stuff: Stuff; to?: string };

/** the job `a` would take on breaking toward `target`: the barrier on its way there (not yet Destroyed), else the nearest
 * wall of their title toward it, or the wall named; 'open' when a hole is already broken there; undefined: nothing */
export function breakJob(state: GameState, a: Actor, target: string | null | undefined): BreakJob | 'open' | undefined {
  const z = zoneById(state, a.zone);
  if (!target || !z) return undefined;
  const way = wayTo(state, a.zone, target), b = barrierOn(state, way?.opening);
  if (way && b && b.state !== 'destroyed') {
    const stuff = barrierStuff(b);
    if (stuff) return { kind: 'barrier', b, opening: way.opening, stuff, to: target };
  }
  const p = a.pos ?? middle(z);
  // the nearest spot on a wall that matches: a dent already begun there (helpers join it), else where a hole fits
  const walls = wallsAround(state, z).filter((x) => x.wall.id === target || x.behind?.id === target);
  const near = walls.map((x) => {
    const raw = toSegment(p, x.wall.a, x.wall.b).at, dent = x.wall.dents?.find((d) => dist(d.at, raw) <= CONFIG.BREAK_HOLE_M[0]);
    return { ...x, dent, at: dent?.at ?? holeSpot(state, x.wall, p) };
  }).filter((x) => x.at).sort((x, y) => dist(x.at!, p) - dist(y.at!, p))[0];
  if (!near) return walls.length ? 'open' : undefined; // the wall is all ways already
  const stuff = wallStuff(near.wall);
  if (!stuff) return undefined;
  return { kind: 'wall', w: near.wall, dent: near.dent ?? { at: near.at!, wear: {}, turn: state.turn }, fresh: !near.dent, from: z, stuff, ...(near.behind ? { to: near.behind.id } : {}) };
}

/** where the breaker stands to work: the doorway, or the spot on the wall */
export function jobAt(state: GameState, a: Actor, job: BreakJob): Located {
  return { zone: a.zone, pos: job.kind === 'wall' ? job.dent.at : job.opening.at };
}
/** the share of the whole work done (everyone's) */
export const jobShare = (job: BreakJob): number => Object.values((job.kind === 'wall' ? job.dent.wear : job.b.wear) ?? {}).reduce((n, x) => n + x, 0);
/** seconds `a` still needs to finish it alone, at their own speed */
export const secondsLeft = (state: GameState, a: Actor, job: BreakJob): number => Math.max(0, 1 - jobShare(job)) * breakSeconds(state, a, job.stuff);

/** BW9 b: a material that regrows loses the work (and its crack closes, a Crippled barrier mends) after CONFIG.REGROW_S with
 * nobody at it */
export function regrow(state: GameState, job: BreakJob): void {
  if (job.stuff.material.trait !== 'regrows') return;
  if (job.kind === 'barrier') {
    if (job.b.wornTurn === undefined || secondsSince(state, job.b.wornTurn) <= CONFIG.REGROW_S) return;
    delete job.b.wear; delete job.b.wornTurn;
    if (job.b.state === 'crippled') delete job.b.state;
    return;
  }
  if (job.fresh || secondsSince(state, job.dent.turn) <= CONFIG.REGROW_S) return;
  job.dent.wear = {};
  const hole = job.dent.hole ? openingById(state, job.dent.hole) : undefined;
  if (hole?.crack) { state.openings.splice(state.openings.indexOf(hole), 1); delete job.dent.hole; planChanged(); }
}

/** BW11 a, BW13 a: `a` puts `seconds` of work into the job: its share grows by seconds over their time; at half it is
 * Crippled, whole it is Destroyed (a barrier's state; a wall's crack, then its hole). Returns the share after and the
 * state reached this time, if any. */
export function addWear(state: GameState, a: Actor, job: BreakJob, seconds: number): { share: number; reached?: 'crippled' | 'destroyed' } {
  const t = breakSeconds(state, a, job.stuff), add = t > 0 ? seconds / t : 1;
  const before = jobShare(job);
  const wear = job.kind === 'wall' ? job.dent.wear : (job.b.wear ??= {});
  wear[a.id] = (wear[a.id] ?? 0) + add;
  const share = Math.min(1, before + add);
  if (job.kind === 'barrier') job.b.wornTurn = state.turn; else job.dent.turn = state.turn;
  if (job.kind === 'wall' && job.fresh) { (job.w.dents ??= []).push(job.dent); job.fresh = false; }
  const crossed = (x: number) => before < x - 1e-9 && share >= x - 1e-9;
  if (crossed(1)) {
    if (job.kind === 'barrier') { job.b.state = 'destroyed'; delete job.b.wear; delete job.b.wornTurn; }
    else {
      cutHole(state, job.w, job.dent.at, job.from, false, job.dent.hole ? openingById(state, job.dent.hole) : undefined);
      job.w.dents = job.w.dents?.filter((d) => d !== job.dent);
      if (!job.w.dents?.length) delete job.w.dents;
    }
    return { share: 1, reached: 'destroyed' };
  }
  if (crossed(0.5)) {
    if (job.kind === 'barrier') job.b.state = 'crippled';
    else job.dent.hole = cutHole(state, job.w, job.dent.at, job.from, true).id;
    return { share, reached: 'crippled' };
  }
  return { share };
}

/** BW23 a: a full spell of work with a tool or weapon is one breakage check on it, by the BK rules: a d100 at the breaker's
 * strength, the tool breaking at its fragility's line. Returns whether it broke. */
export function toolCheck(state: GameState, a: Actor, rng: Rng): { tool?: string; broke?: true } {
  const t = breakTool(state, a), inst = t ? a.core.inventory.find((i) => i.id === t.itemId) : undefined;
  if (!inst) return {};
  const lv = tierOf(rng.d100(), breakStrength(state, a), [], []);
  const i = Math.max(0, Math.min(TIERS.keys.length - 1, lv));
  const roll: TierRoll = { tier: TIERS.keys[i], ...(lv !== i ? { beyond: lv - i } : {}) };
  return { tool: inst.id, ...(breakInside(state, a, [inst], roll).length ? { broke: true as const } : {}) };
}


/** what a walker strong enough walks through on its way (BW21 a): a wall, at the point the line meets it, between titles
 * from and to; or a shut barrier */
export type WalkBreak = { wall: Wall; at: Pt; from: Zone; to?: Zone; t: number } | { barrier: Barrier; opening: Opening; t: number };
const KNEE_M = 0.3;
/** BW21 a: a walker for whom breaking a wall or barrier takes WALK_THROUGH_S or less is not stopped by it: when the
 * straight line from them to the goal (on one floor) meets only things they walk through or pass anyway, and (when it
 * meets a wall) it is shorter than the walk round (or there is none), the walk goes straight through. Returns what it breaks within the first
 * `metres` (the rest wait for the next leg), or null when the walk goes round as usual. */
export function walkBreaks(state: GameState, a: Actor, goal: Located, metres: number): WalkBreak[] | null {
  let A, B;
  try { A = pointAt(state, a); B = goalPoint(state, goal); } catch { return null; }
  if (Math.abs(A.floor - B.floor) > 0.01) return null;
  const L = dist(A, B);
  if (L <= 1e-6) return null;
  const out: WalkBreak[] = [];
  for (const c of crossings(state, { x: A.x, y: A.y, z: A.floor + KNEE_M }, { x: B.x, y: B.y, z: B.floor + KNEE_M })) {
    if (c.kind === 'roof') return null;
    const side = (dt: number) => zoneAt(state, lerp(A, B, Math.min(1, Math.max(0, c.t + dt))), A.floor);
    if (c.opening) {
      const b = barrierOn(state, c.opening);
      if (!b) { if (c.opening.crack || c.opening.frontier || !getLibrary().openingKinds?.[c.opening.kind]?.walk) return null; continue; }
      const from = side(-0.01 / L)?.id ?? a.zone;
      if (passage(b, a, from) !== 'shut') continue;
      const stuff = barrierStuff(b);
      if (!stuff || !walksThrough(state, a, stuff)) return null;
      out.push({ barrier: b, opening: c.opening, t: c.t });
      continue;
    }
    if (wallKind(c.wall.kind)?.walk) continue;
    const stuff = wallStuff(c.wall), from = side(-0.05 / L);
    if (!stuff || !from || !walksThrough(state, a, stuff)) return null;
    out.push({ wall: c.wall, at: c.at, from, ...(side(0.05 / L) ? { to: side(0.05 / L) } : {}), t: c.t });
  }
  if (!out.length) return null;
  // a wall is broken only to save walking round it (a door on the line is the way anyway)
  const round = out.some((x) => 'wall' in x) ? walkPath(state, A, B, { walker: a, body: a }) : null;
  if (round && round.metres <= L + 1e-6) return null;
  return out.filter((x) => x.t * L <= metres + 1e-6);
}
