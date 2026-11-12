// isActive; bands, relations and overrides; engagement (Part 2, Information model and Who thinks for each actor).
import type { Actor, Belief, BeliefStatus, GameState, Stance, ZoneLink } from '../types';
import { AWARENESS, STANCES } from '../scales';
import { firstSightOf } from '../ruleset/achRewards';
import { barrierOn, knowsShut, linkPassage } from './barriers';

export function allActors(state: GameState): Actor[] {
  return [state.player, ...state.actors];
}
export function actorById(state: GameState, id: string): Actor | undefined {
  return id === state.player.id ? state.player : state.actors.find((a) => a.id === id);
}
export function bandById(state: GameState, id: string) {
  return state.bands.find((b) => b.id === id);
}

/** false while incapacitated (100% HP lost). */
export function isActive(actor: Actor): boolean {
  return actor.core.condition.hpLostPct < 100;
}
/** A8 Hold: the actor holding `a`, while that hold still stands (the holder is active and in a's zone) */
export function heldBy(state: GameState, a: Actor): Actor | undefined {
  const h = a.heldBy ? actorById(state, a.heldBy) : undefined;
  return h && isActive(h) && h.zone === a.zone && isActive(a) ? h : undefined;
}
/** broken and surrendered actors count on neither side of engagement (Part 3, Morale). */
export function countsInFight(actor: Actor): boolean {
  return isActive(actor) && !actor.mind?.moraleState;
}

/** stance(a, b) = a's override for b, else the relation of a's band to b's band. Same band: friendly. */
export function stance(state: GameState, a: Actor, b: Actor): Stance {
  const o = a.mind?.overrides?.[b.id];
  if (o) return o;
  if (a.bandId === b.bandId) return 'friendly';
  const s = bandById(state, a.bandId)?.relations[b.bandId] ?? 'neutral';
  // an achievement's first-sight reward: a hunted kind meets b wary until b attacks it (the attack sets a hostile override)
  return s === 'hostile' && firstSightOf(b, a) ? 'opposed' : s;
}
/** friendly or warmer (friendly, friend, loyal) */
export const warm = (s: Stance): boolean => s !== 'yielded' && STANCES.pos(s) >= STANCES.pos('friendly');
/** hostile: a attacks b on sight. RS3 loyal: a takes the side of anyone it is loyal to, so whoever is hostile to them
 * is hostile to a too, unless a is friendly or warmer toward that one. A friend does the same only against someone a is
 * already opposed (or colder) to. */
export function hostile(state: GameState, a: Actor, b: Actor): boolean {
  if (truce(state, a, b)) return false;
  const s = stance(state, a, b);
  if (s === 'hostile') return true;
  if (s === 'yielded' || warm(s)) return false;
  const opposed = STANCES.pos(s) <= STANCES.pos('opposed');
  return allActors(state).some((c) => {
    if (c === a || c === b || !isActive(c) || stance(state, b, c) !== 'hostile') return false;
    const ac = stance(state, a, c);
    return ac === 'loyal' || (ac === 'friend' && opposed);
  });
}
/** MB42: the player and a foe that took the player's yield are at truce for the rest of the scenario */
export function truce(state: GameState, a: Actor, b: Actor): boolean {
  const y = state.yielding;
  const other = a === state.player ? b : b === state.player ? a : undefined;
  return !!y && !!other && y.accepted.includes(other.id);
}
/** SP1: the live spar that has a and b on different sides with neither out yet (SP4, SP5) */
export function sparBetween(state: GameState, a: Actor, b: Actor) {
  if (a === b || !isActive(a) || !isActive(b)) return undefined;
  return state.spars?.find((sp) => {
    if (a.id in sp.out || b.id in sp.out) return false;
    const sa = sp.sides.findIndex((s) => s.includes(a.id)), sb = sp.sides.findIndex((s) => s.includes(b.id));
    return sa >= 0 && sb >= 0 && sa !== sb;
  });
}
export const sparring = (state: GameState, a: Actor, b: Actor): boolean => !!sparBetween(state, a, b);
/** a fights b: for real (hostile) or in a spar (SP1). Stance and XP rules use hostile; fighting rules use foe. */
export const foe = (state: GameState, a: Actor, b: Actor): boolean => hostile(state, a, b) || sparring(state, a, b);
/** wary: opposed or colder. a's alert fires when it notices b, but only hostile attacks. */
export function wary(state: GameState, a: Actor, b: Actor): boolean {
  const s = stance(state, a, b);
  return s !== 'yielded' && STANCES.pos(s) <= STANCES.pos('opposed');
}

export function atLeast(status: BeliefStatus | undefined, min: BeliefStatus): boolean {
  return AWARENESS.pos(status ?? 'unaware') >= AWARENESS.pos(min);
}

/** CH7: the chase after this actor was lost and the chaser has not seen or heard it since */
export const chaseLost = (b: Belief | undefined): boolean => b?.lostTurn !== undefined && (b.lastSeenTurn ?? -Infinity) <= b.lostTurn;

/** Engaged = active (and not broken/surrendered), and believes (suspicious or higher) in an active actor it is hostile to
 * or sparring with (SP1). A chase it lost (CH7) does not count until it sees or hears them again. */
export function isEngaged(state: GameState, actor: Actor): boolean {
  if (!countsInFight(actor)) return false;
  // the player has no beliefs: it is in a fight while someone who counts in one is fighting it, for real or in a spar
  if (actor.kind === 'player') return allActors(state).some((o) => { const b = o.mind?.knowledge?.[actor.id]; return o !== actor && countsInFight(o) && foe(state, o, actor) && atLeast(b?.status, 'suspicious') && !chaseLost(b); });
  const k = actor.mind?.knowledge ?? {};
  return Object.entries(k).some(([id, b]) => {
    if (!atLeast(b.status, 'suspicious') || chaseLost(b)) return false;
    const other = actorById(state, id);
    return !!other && countsInFight(other) && foe(state, actor, other);
  });
}

/** hasAgenda is derived, never stored: holds a secret, has a plan, remembers something or is in a deal (PM3). */
export function hasAgenda(state: GameState, actorId: string): boolean {
  return (
    state.hidden.secrets.some((s) => s.holderId === actorId) ||
    !!state.hidden.plans[actorId] ||
    !!state.hidden.memory[actorId]?.length ||
    !!state.hidden.agreements?.some((g) => g.parties.includes(actorId))
  );
}

export function zoneById(state: GameState, id: string) {
  for (const p of state.places) {
    const z = p.zones.find((zz) => zz.id === id);
    if (z) return z;
  }
  return undefined;
}

/** BG-70: sight passes this link: a sight link, or a way whose door stands open */
export const seesAcross = (state: GameState, l: ZoneLink): boolean => l.sight || !!barrierOn(state, l)?.open;

/** own zone plus zones linked to it with sight (no frontiers): what a viewer in `zoneId` perceives */
export function perceivedZoneIds(state: GameState, zoneId: string): string[] {
  const z = zoneById(state, zoneId);
  return [zoneId, ...(z?.links ?? []).filter((l) => seesAcross(state, l) && !l.frontier && zoneById(state, l.to)).map((l) => l.to)];
}

/** SD3–SD5: the walking path for `walker`: round any barrier shut to it; with none, the plain path (whose first shut way
 * the walker then tries) */
export const wayPath = (state: GameState, from: string, to: string, walker: Actor): string[] | null =>
  shortestPath(state, from, to, false, walker) ?? shortestPath(state, from, to);

/** shortest path over stage zones (no frontiers). Returns the zone ids after `from`, or null. With a `walker`, a way whose
 * barrier is shut to it (no key, the far side of the bar, rubble) is left out (SD3–SD5); with none, barriers are ignored
 * (how far away, for sound and sight). */
export function shortestPath(state: GameState, from: string, to: string, sightOnly = false, walker?: Actor): string[] | null {
  if (from === to) return [];
  const stage = new Set(state.stage.zoneIds);
  const prev = new Map<string, string>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const cur = q.shift()!;
    const z = zoneById(state, cur);
    for (const l of z?.links ?? []) {
      // SD7: a drop (window, ledge) is seen through but never walked: only a jump takes it (resolve.ts doMove)
      if (l.frontier || !stage.has(l.to) || seen.has(l.to) || (sightOnly && !seesAcross(state, l)) || (l.drop && !sightOnly)) continue;
      if (walker && linkPassage(state, l, walker, cur) === 'shut' && knowsShut(barrierOn(state, l)!, walker)) continue;
      seen.add(l.to);
      prev.set(l.to, cur);
      if (l.to === to) {
        const path = [to];
        let p = cur;
        while (p !== from) {
          path.unshift(p);
          p = prev.get(p)!;
        }
        return path;
      }
      q.push(l.to);
    }
  }
  return null;
}
