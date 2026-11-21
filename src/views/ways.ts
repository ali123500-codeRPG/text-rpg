// BG-1614 (AGENTS.md rule 8): where a code mind's walks go, decided here by metres where the state is, so the routines
// (minds/routines.ts) read only the answer and never count doors. The way to a title is the walk over the floor plan
// (walkRoute); a flight runs from the nearest threat (by straight line when in sight, else by walk) through the way out
// whose point is farthest from it by walk.
import type { Actor, BeliefView, GameState, MapZone, RoutineInput, WaysView } from '../types';
import { distM, frontierPoint, pathM, placeOf, spotAt, walkRoute, wayPoint, type Located } from '../engine/position';
import { actorById } from '../engine/relations';
import { desiredState } from '../minds/routines';
import { routine } from '../library';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** the first title on `a`'s walk to `goal`, round the ways it knows are shut (never through a frontier or a drop); null
 * with none, or where a title on the way has no footprint */
function nextOn(state: GameState, a: Actor, goal: Located): string | null {
  if (goal.zone === a.zone) return null;
  try { return walkRoute(state, placeOf(a), goal, a, true)?.path[0] ?? null; } catch { return null; }
}

/** NW2: a head_to walk bound for a frontier off its map: the title on its map with a way into that frontier nearest by its
 * walk to where the way is left */
export function headEdge(state: GameState, a: Actor, map: MapZone[]): string | undefined {
  const r = a.mind?.routine, dest = first(a.mind?.slots?.dest);
  if (!r || routine(r.id).kind !== 'head' || !dest || map.some((z) => z.id === dest)) return undefined;
  const m = (z: string) => { const p = frontierPoint(state, z, dest); try { return pathM(state, placeOf(a), { zone: z, ...(p ? { pos: p } : {}) }, a); } catch { return Infinity; } };
  const edges = map.filter((z) => z.links.some((l) => l.frontier && l.to === dest)).map((z) => ({ z: z.id, m: m(z.id) }));
  return edges.length ? edges.reduce((best, e) => (e.m < best.m ? e : best)).z : undefined;
}

/** where `a` places someone it believes in: where they stand when it perceives them now, else its last known point (or
 * title), with the metres to there: by straight line in sight, else by walk */
function believedAt(state: GameState, a: Actor, b: BeliefView, seen: Set<string>): { at: Located; m: number } {
  const other = actorById(state, b.about);
  if (other && seen.has(b.about)) return { at: placeOf(other), m: distM(state, a, other) };
  const at = spotAt(b.lastKnownZone!, a.mind?.knowledge[b.about]?.lastKnownAt);
  try { return { at, m: pathM(state, placeOf(a), at, a) }; } catch { return { at, m: Infinity }; }
}

/** BF79: whom a flight runs from: those it is hostile to, and those it yielded to (Q4), placed somewhere */
const feared = (beliefs: BeliefView[]) => beliefs.filter((b) => (b.hostile || b.stance === 'yielded') && b.active && b.status !== 'unaware' && b.lastKnownZone);
/** those it fights: hostile, or a spar opponent (SP1), placed somewhere */
const hunted = (beliefs: BeliefView[]) => beliefs.filter((b) => (b.hostile || b.sparring) && b.active && b.status !== 'unaware' && b.lastKnownZone);

/** BF79: the title a flight steps into: toward its exit or refuge while that way leads away from the nearest threat, else
 * through the way out of its title (never a frontier, a drop or a way shut to it) that leads away and whose point is
 * farthest by walk from the nearest threat; undefined at its exit or refuge, or with no way away: it cowers */
function fleeTo(state: GameState, a: Actor, beliefs: BeliefView[], seen: Set<string>, map: MapZone[]): string | undefined {
  const threat = feared(beliefs).map((b) => ({ id: b.about, ...believedAt(state, a, b, seen) }))
    .sort((x, y) => x.m - y.m || x.id.localeCompare(y.id))[0];
  const m = (at: Located): number => { try { return pathM(state, threat!.at, at); } catch { return NaN; } };
  // the way's point on this side, which ranks the ways out; a walk leads away when where it ends (the title, as the
  // flight walks to it and engine/nerve.ts walksAway judges it) is farther from the threat than it stands
  const from = (to: string): number => { const p = wayPoint(state, a.zone, to); return m(p ? { zone: a.zone, pos: p } : { zone: to }); };
  let here: number | undefined;
  const away = (to: string) => m({ zone: to }) > (here ??= m(placeOf(a)));
  for (const key of ['exit', 'refuge']) {
    const zone = first(a.mind?.slots?.[key]);
    if (!zone) continue;
    if (zone === a.zone) return undefined;
    const next = nextOn(state, a, { zone });
    if (next && (!threat || away(next))) return next;
  }
  if (!threat) return undefined;
  let best: string | undefined, bestM = -Infinity;
  for (const l of map.find((z) => z.id === a.zone)?.links ?? []) {
    if (l.frontier || l.drop || l.shut || !away(l.to)) continue;
    const d = from(l.to);
    if (d > bestM) [best, bestM] = [l.to, d];
  }
  return best;
}

/** BG-1614: the WaysView of `a`'s view: the next title toward where its routine wants it and toward each one it hunts; a
 * flight's title when it may flee (broken, or a code-run NPC with someone to fear or lying as if dead) */
export function waysView(state: GameState, a: Actor, beliefs: BeliefView[], seen: Set<string>, map: MapZone[], self: RoutineInput['self']): WaysView {
  const goals = new Map<string, Located>();
  const want = desiredState({ self, beliefs, map })?.zone;
  if (want) goals.set(want, { zone: want });
  for (const b of hunted(beliefs)) if (!goals.has(b.lastKnownZone!)) goals.set(b.lastKnownZone!, spotAt(b.lastKnownZone!, a.mind?.knowledge[b.about]?.lastKnownAt));
  const next: Record<string, string> = {};
  for (const [z, at] of goals) { const n = nextOn(state, a, at); if (n) next[z] = n; }
  const m = a.mind!;
  const flees = m.moraleState === 'broken' || (m.control === 'code' && (!!a.playingDead || feared(beliefs).length > 0));
  const flee = flees ? fleeTo(state, a, beliefs, seen, map) : undefined;
  return { next, ...(flee ? { flee } : {}) };
}
