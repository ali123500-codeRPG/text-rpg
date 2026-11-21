// NP1 a (placeholder, to be tested): activity tiers. Each turn, the NPCs relevant to the player are simulated in full: they
// get an order, act and make events. The rest get no order that turn; their routines move them on the clock at the turn's
// end (catchUp, NW11), and they still perceive what relevant actors do. Worked out afresh every turn from the world, so
// nothing about it is saved.
import { CONFIG } from '../config';
import { actorBody, routine } from '../library';
import { maxSightFactor } from '../library/bodySize';
import { SK } from '../library/skillIds';
import { effectiveSkill } from '../ruleset/gear';
import { perkSum } from '../ruleset/perks';
import type { Actor, GameState } from '../types';
import type { TurnInput } from './types';
import { drawnTo } from './perkMarks';
import { leastGapM } from './position';
import { actorById, atLeast, bandById, foe, isActive, isEngaged, mayFight } from './relations';
import { perceivesNow } from './yield';

/** the ids of everyone simulated in full this turn: the player, and each NPC that (1) is in the player's senses or has the
 * player in its own; (2) has its mind on the player (follows them, believes in them at Tracking or above, heads to where it
 * thinks they are, or holds a goal or a plan trigger that names them); (3) is in a fight or within sense range of a foe;
 * (4) is within sense range of anyone under 1 to 3. Also anyone the player's intent names, and anyone whose turn something other than its routine takes (a trigger,
 * its agent, an alert, flight, a long action, a hold, a suspicion, a draw), so nothing under way is cut off, and anyone at the edge of unbuilt ground, whose step
 * into it starts its building (NW3), which the catch-up, stopping there, would not. */
export function relevantActors(state: GameState, input: Pick<TurnInput, 'intent' | 'agentOutputs' | 'spokespeople' | 'fired'>): Set<string> {
  const p = state.player;
  const npcs = state.actors.filter(isActive);
  const out = new Set<string>([p.id]);
  const near = senseRange(state);
  const taken = new Set<string>([...(input.fired ?? []).map((o) => o.actorId), ...input.agentOutputs.map((o) => o.actorId), ...input.spokespeople, ...(state.pending?.engaged ?? []),
    ...named(input.intent)]);
  const edge = new Set(state.openings.filter((o) => o.frontier).map((o) => o.joins[0]));
  const holding = new Set(state.actors.map((a) => a.heldBy).filter((h): h is string => !!h));
  for (const a of npcs) {
    const m = a.mind;
    const busyTurn = taken.has(a.id) || !!m?.alarm?.onAlertDue || !!m?.moraleState || !!a.busy || !!a.heldBy || holding.has(a.id)
      || !!(m?.suspects && Object.keys(m.suspects).length) || !!drawnTo(state, a) || isEngaged(state, a) || edge.has(a.zone);
    if (busyTurn || mindOnPlayer(state, a) || near(p, a)) out.add(a.id);
  }
  // 3: a foe pair within sense range of each other, either way
  for (const a of npcs) {
    if (!mayFight(state, a)) continue;
    for (const b of foeCandidates(state, a)) if (b !== a && foe(state, a, b) && near(a, b)) { out.add(a.id); out.add(b.id); }
  }
  // 4: one step out from everyone above
  const core = [...out].map((id) => actorById(state, id)).filter((x): x is Actor => !!x);
  for (const x of npcs) if (!out.has(x.id) && core.some((r) => near(r, x))) out.add(x.id);
  return out;
}

/** 2: its mind is on the player */
/** whom the player's intent names this turn: its target, the one it buys for or walks near or away from, those it speaks to */
const named = (i: TurnInput['intent']): string[] =>
  [i?.action?.target, i?.action?.for, i?.perkMove?.target, i?.move?.spot?.near, i?.move?.spot?.awayFrom, ...(i?.addressees ?? [])].filter((x): x is string => !!x);

function mindOnPlayer(state: GameState, a: Actor): boolean {
  const p = state.player, m = a.mind;
  if (!m) return false;
  const kind = m.routine ? routine(m.routine.id).kind : undefined;
  const belief = m.knowledge[p.id];
  if (kind === 'follow' || atLeast(belief?.status, 'tracking')) return true;
  const dest = m.slots?.dest, to = Array.isArray(dest) ? dest[0] : dest;
  if (kind === 'head' && to && (to === p.zone || to === belief?.lastKnownZone)) return true;
  if (state.hidden.drives?.[a.id]?.goals.some((g) => g.about?.includes(p.id))) return true;
  return !!state.hidden.plans[a.id]?.triggers.some((t) => t.when.type.startsWith('player'));
}

/** the actors `a` could be a foe of: everyone when a stance of its own can turn on anyone (cooled on sight, an ally's side, a
 * spar), else those its overrides or its band's relations hold hostile; foe() decides */
function foeCandidates(state: GameState, a: Actor): Actor[] {
  const o = a.mind?.overrides ?? {}, rel = bandById(state, a.bandId)?.relations ?? {};
  const wide = !!a.sightChecks?.length || Object.values(o).some((s) => s === 'loyal' || s === 'friend') || Object.values(rel).some((s) => s === 'loyal' || s === 'friend')
    || !!state.spars?.some((sp) => sp.sides.some((side) => side.includes(a.id)));
  if (wide) return state.actors;
  const bands = new Set(Object.entries(rel).filter(([, s]) => s === 'hostile').map(([b]) => b));
  return state.actors.filter((b) => bands.has(b.bandId) || o[b.id] === 'hostile');
}

/** "within sense range": either perceives the other just being there (perceivesNow, faint). A pair farther apart than any sense
 * of the probe could reach (the sight table's farthest for a normal look at the biggest the other can look, a faint sound
 * with the observer's hearing perks, the observer's Scent in metres) is out of range without probing */
function senseRange(state: GameState): (x: Actor, y: Actor) => boolean {
  const scent = new Map<string, number>();
  const reach = (o: Actor, y: Actor) => {
    if (!scent.has(o.id)) scent.set(o.id, Math.max(0, effectiveSkill(state, o, SK.scent).value));
    const sight = (CONFIG.SIGHT_M.normal?.[1] ?? 0) * maxSightFactor(actorBody(state, y).size);
    const sound = 10 ** (((CONFIG.NOISE_DB.faint ?? 0) + perkSum(o, 'hearingDb') - CONFIG.HEARING_FLOOR_DB) / 20);
    return Math.max(sight, sound, CONFIG.NEAREST_M, scent.get(o.id)!);
  };
  const sees = (o: Actor, y: Actor) => leastGapM(state, o, y) <= reach(o, y) && perceivesNow(state, o, y, 'faint');
  return (x, y) => sees(x, y) || sees(y, x);
}
