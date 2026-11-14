// isActive; bands, relations and overrides; engagement (Part 2, Information model and Who thinks for each actor).
import type { Actor, Barrier, Belief, BeliefStatus, GameState, Stance, ZoneLink } from '../types';
import { AWARENESS, STANCES } from '../scales';
import { firstSightOf } from '../ruleset/achRewards';
import { healthLevel, isDownLevel } from '../ruleset/body';
import { barrierOn, linkPassage } from './barriers';
import { withinGrip } from './position';
import { reachesOver } from '../scenario/geometry';
import { getLibrary } from '../library';

/** the actor's active perks and quirks that work on sight (PerkDef.onSight) */
export const onSightPerks = (a: Actor) => a.core.perks.filter((p) => !p.dormant).map((p) => getLibrary().perks?.[p.perkId]).filter((d): d is NonNullable<typeof d> => !!d?.onSight);

export function allActors(state: GameState): Actor[] {
  return [state.player, ...state.actors];
}
export function actorById(state: GameState, id: string): Actor | undefined {
  return id === state.player.id ? state.player : state.actors.find((a) => a.id === id);
}
export function bandById(state: GameState, id: string) {
  return state.bands.find((b) => b.id === id);
}

/** up and acting: not at a down level of the health track (one rule with the track, so a level's edge can't disagree) */
export function isActive(actor: Actor): boolean {
  return !isDownLevel(healthLevel(actor));
}
/** NW12/NW20: asleep (src/engine/sleep.ts): perceives nothing, acts not at all, and is struck as unaware */
export const isAsleep = (actor: Actor): boolean => !!actor.asleep && isActive(actor);
/** A8 Hold: the actor holding `a`, while that hold still stands (the holder is active and `a` within its grip reach: BG-104) */
export function heldBy(state: GameState, a: Actor): Actor | undefined {
  const h = a.heldBy ? actorById(state, a.heldBy) : undefined;
  return h && isActive(h) && withinGrip(state, h, a) && isActive(a) ? h : undefined;
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
  if (s === 'hostile' && firstSightOf(b, a)) return 'opposed';
  // Dreaded on Sight: once a has seen b, its band's stance reads colder (the player holds no stances)
  if (a.kind === 'player' || s === 'yielded') return s;
  const colder = onSightPerks(b).reduce((n, d) => n + (a.sightChecks?.includes(`${d.id}:${b.id}`) ? d.onSight!.colder : 0), 0);
  return colder ? STANCES.at(Math.max(0, STANCES.pos(s) - colder)) : s;
}
/** opposed or colder (opposed, hostile) */
const cold = (s: Stance): boolean => s !== 'yielded' && STANCES.pos(s) <= STANCES.pos('opposed');
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
  const opposed = cold(s);
  return allActors(state).some((c) => {
    if (c === a || c === b || !isActive(c) || stance(state, b, c) !== 'hostile') return false;
    const ac = stance(state, a, c);
    return ac === 'loyal' || (ac === 'friend' && opposed);
  });
}
/** MB42: the player and a foe that took the player's yield are at truce for the rest of the scenario; TF16: so are those
 * at a stand-down truce (engine/offer.ts) */
export function truce(state: GameState, a: Actor, b: Actor): boolean {
  if (state.offers?.truces[a.id]?.includes(b.id)) return true;
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
export const wary = (state: GameState, a: Actor, b: Actor): boolean => cold(stance(state, a, b));

export function atLeast(status: BeliefStatus | undefined, min: BeliefStatus): boolean {
  return AWARENESS.pos(status ?? 'unaware') >= AWARENESS.pos(min);
}

/** CH7: the chase after this actor was lost and the chaser has not seen or heard it since */
export const chaseLost = (b: Belief | undefined): boolean => b?.lostTurn !== undefined && (b.lastSeenTurn ?? -Infinity) <= b.lostTurn;

/** those who count in a fight and are after `p` (who holds no beliefs): a foe, for real or in a spar, that believes in it
 * (suspicious or higher) and has not lost its chase */
export function foesAfter(state: GameState, p: Actor): Actor[] {
  return allActors(state).filter((o) => { const b = o.mind?.knowledge?.[p.id]; return o !== p && countsInFight(o) && foe(state, o, p) && atLeast(b?.status, 'suspicious') && !chaseLost(b); });
}

/** Engaged = active (and not broken/surrendered), and believes (suspicious or higher) in an active actor it is hostile to
 * or sparring with (SP1). A chase it lost (CH7) does not count until it sees or hears them again. */
export function isEngaged(state: GameState, actor: Actor): boolean {
  if (!countsInFight(actor)) return false;
  // the player has no beliefs: it is in a fight while someone who counts in one is fighting it, for real or in a spar
  if (actor.kind === 'player') return foesAfter(state, actor).length > 0;
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
    !!state.hidden.drives?.[actorId]?.goals.length || // UG1: a goal holder is voiced by the Responder
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

/** BG-69, FR5: a walk is planned around a shut way only by someone who knows it is shut: they tried it, or it is rubble in
 * plain view; an NPC also knows the ways of a place it lives or works in (one its routine is bound to: mind.slots). A
 * visitor learns by trying, as the player does; a bolt on the far side is not known from the near side. */
export function knowsShut(state: GameState, b: Barrier, a: Actor, from: string): boolean {
  if (b.blocked || b.tried?.includes(a.id)) return true;
  const place = a.kind === 'player' ? undefined : zoneById(state, from)?.placeId;
  return !!place && Object.values(a.mind?.slots ?? {}).flat().some((z) => zoneById(state, z)?.placeId === place);
}

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
      if (walker && linkPassage(state, l, walker, cur) === 'shut' && knowsShut(state, barrierOn(state, l)!, walker, cur)) continue;
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

/** across a counter, fence or rail from zone `a` into the next zone `b`: see and reach across it (edge kind Low) */
export function reachesAcross(state: GameState, a: string, b: string): boolean {
  const A = zoneById(state, a), B = zoneById(state, b);
  // BG-124: only across a way that is seen through (a counter, a rail), never a door
  return !!A && !!B && A.links.some((l) => l.to === B.id && seesAcross(state, l)) && reachesOver(A, B, getLibrary().edgeKinds ?? {});
}

/** BG-95: one rule for who knows whose name, player and NPC alike: their own, a public figure's (knownOnSight), a
 * bandmate's, or one learned by hearing it said (learnNames) */
export function knowsName(state: GameState, viewer: Actor, a: Actor): boolean {
  if (a === viewer || a.knownOnSight || (viewer.bandId && viewer.bandId === a.bandId)) return true;
  return !!namesOf(state, viewer)?.namesKnown?.includes(a.id);
}
/** where the viewer keeps names: the player's journal, an NPC's mind */
const namesOf = (state: GameState, viewer: Actor) => (viewer.id === state.player.id ? state.player.journal : viewer.mind);
/** BG-95/NM2/NM3: the viewer's name lists (the player's journal or an NPC's mind), made on first write */
export function nameBook(state: GameState, viewer: Actor): { known: string[]; heardOf: string[]; aliases: Record<string, string> } | undefined {
  const b = namesOf(state, viewer);
  if (!b) return undefined;
  return { known: (b.namesKnown ??= []), heardOf: (b.heardOf ??= []), aliases: (b.aliases ??= {}) };
}
/** what the viewer calls `a` by name: the real one once known, else a false name it believed (NM3), else none */
export function nameFor(state: GameState, viewer: Actor, a: Actor): string | undefined {
  if (knowsName(state, viewer, a)) return a.names.current;
  return namesOf(state, viewer)?.aliases?.[a.id];
}
