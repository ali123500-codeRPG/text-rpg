// SC12: what a check-in's "continue" may do besides beats: change the running scene (question, scale, endings), send
// people in through ways that already exist (arrivals), and add new frontiers. It never builds zones into a place: the
// world grows through the frontiers it adds, which the normal stage extension builds when the player crosses one.
import type { CheckinAnswer, GameState, Rng, StagePlan, ZoneLink } from '../types';
import { stageFrontiers, validateStagePlan } from './validate';
import { applyStagePlan, freshId } from './apply';
import { perceivedZoneIds, zoneById } from '../engine/relations';

/** the stage plan a check-in's change and arrivals amount to (no places, zones or rewards), or null when it has neither */
export function checkinPlan(state: GameState, a: CheckinAnswer): StagePlan | null {
  const f = state.stage.scene;
  if (!a.change && !a.arrivals) return null;
  return {
    event: { summary: '', challenge: 'none', gain: 'none' }, places: [], zones: [], frontiers: [],
    bands: a.arrivals?.bands ?? [], cast: a.arrivals?.cast ?? [], seeds: a.arrivals?.seeds ?? { plans: [], triggers: [], secrets: [] },
    rewards: [], hiddenTerms: [...(state.hidden.stage?.hiddenTerms ?? [])], weaverNote: state.hidden.weaverNote ?? '',
    ...(a.change && f ? { scene: { question: a.change.question ?? f.question, scale: a.change.scale ?? f.scale, endings: a.change.endings ?? f.endings } } : {}),
  } as StagePlan;
}

/** errors in a check-in's change, arrivals and frontiers (empty = fine) */
export function checkinPlanErrors(state: GameState, a: CheckinAnswer): string[] {
  const errors: string[] = [];
  const plan = checkinPlan(state, a);
  if (plan) {
    errors.push(...validateStagePlan(state, plan, { kind: 'checkin', tier: state.stage.tier, placeId: state.player.placeId }).filter((e) => !e.repaired).map((e) => e.message));
    // arrivals come in through ways that exist: each starts on a stage zone the player cannot see now, and walks in
    const seen = new Set(perceivedZoneIds(state, state.player.zone));
    for (const c of plan.cast) {
      const start = Object.values(c.slots ?? {}).flat().find((z) => typeof z === 'string' && state.stage.zoneIds.includes(z));
      if (!start) errors.push(`arrival ${c.key}: bind a slot to a stage zone it comes in by`);
      else if (seen.has(start)) errors.push(`arrival ${c.key}: ${start} is in the player's sight; arrivals come in from out of sight`);
    }
  }
  const taken = new Set([...state.zones.map((z) => z.id), ...stageFrontiers(state)]);
  for (const fr of a.frontiers ?? []) {
    if (!fr || typeof fr !== 'object' || !state.stage.zoneIds.includes(fr.zone)) errors.push(`frontier ${fr?.key}: zone ${fr?.zone} is not on the stage`);
    else if (typeof fr.key !== 'string' || !fr.key || taken.has(fr.key)) errors.push(`frontier ${fr.key}: give a new key`);
    else if (typeof fr.label !== 'string' || !fr.label.trim()) errors.push(`frontier ${fr.key}: give a label`);
  }
  return errors;
}

/** applies a checked answer's change, arrivals and frontiers; returns what it did, for the log */
export function applyCheckinPlan(state: GameState, a: CheckinAnswer, rng: Rng): { changed: boolean; arrivals: number; frontiers: number } {
  const plan = checkinPlan(state, a);
  if (plan) applyStagePlan(state, plan, { kind: 'checkin', tier: state.stage.tier, placeId: state.player.placeId }, { entry: 'open' }, rng);
  const taken = new Set([...state.zones.map((z) => z.id), ...stageFrontiers(state)]);
  for (const fr of a.frontiers ?? []) {
    const link: ZoneLink = { to: freshId(fr.key, taken), label: fr.label, sight: false, frontier: true };
    taken.add(link.to);
    zoneById(state, fr.zone)!.links.push(link);
  }
  return { changed: !!a.change, arrivals: plan?.cast.length ?? 0, frontiers: a.frontiers?.length ?? 0 };
}
