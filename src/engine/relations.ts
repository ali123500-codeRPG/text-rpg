// isActive; bands, relations and overrides; engagement (Part 2, Information model and Who thinks for each actor).
import type { Actor, BeliefStatus, GameState, Stance } from '../types';
import { BELIEF_ORDER } from '../types';

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
/** broken and surrendered actors count on neither side of engagement (Part 3, Morale). */
export function countsInFight(actor: Actor): boolean {
  return isActive(actor) && !actor.mind?.moraleState;
}

/** opposed(a, b) = a's override for b, else the relation of a's band to b's band. Same band: friendly. */
export function stance(state: GameState, a: Actor, b: Actor): Stance {
  const o = a.mind?.overrides?.[b.id];
  if (o) return o;
  if (a.bandId === b.bandId) return 'friendly';
  return bandById(state, a.bandId)?.relations[b.bandId] ?? 'neutral';
}
export function opposed(state: GameState, a: Actor, b: Actor): boolean {
  return stance(state, a, b) === 'opposed';
}

export function atLeast(status: BeliefStatus | undefined, min: BeliefStatus): boolean {
  return BELIEF_ORDER.indexOf(status ?? 'unaware') >= BELIEF_ORDER.indexOf(min);
}

/** Engaged = active (and not broken/surrendered), and believes (suspicious or higher) in an active actor it is opposed to. */
export function isEngaged(state: GameState, actor: Actor): boolean {
  if (actor.kind === 'player' || !countsInFight(actor)) return false;
  const k = actor.mind?.knowledge ?? {};
  return Object.entries(k).some(([id, b]) => {
    if (!atLeast(b.status, 'suspicious')) return false;
    const other = actorById(state, id);
    return !!other && countsInFight(other) && opposed(state, actor, other);
  });
}

/** hasAgenda is derived, never stored: holds a secret, has a plan or has a memory note. */
export function hasAgenda(state: GameState, actorId: string): boolean {
  return (
    state.hidden.secrets.some((s) => s.holderId === actorId) ||
    !!state.hidden.plans[actorId] ||
    !!state.hidden.memory[actorId]
  );
}

export function zoneById(state: GameState, id: string) {
  for (const p of state.places) {
    const z = p.zones.find((zz) => zz.id === id);
    if (z) return z;
  }
  return undefined;
}

/** shortest path over stage zones (no frontiers). Returns the zone ids after `from`, or null. */
export function shortestPath(state: GameState, from: string, to: string, sightOnly = false): string[] | null {
  if (from === to) return [];
  const stage = new Set(state.stage.zoneIds);
  const prev = new Map<string, string>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const cur = q.shift()!;
    const z = zoneById(state, cur);
    for (const l of z?.links ?? []) {
      if (l.frontier || !stage.has(l.to) || seen.has(l.to) || (sightOnly && !l.sight)) continue;
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
