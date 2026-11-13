// LI5b/LI6 Gut Feeling (Insight 20): a hunch of being watched. At the start of each turn, the owner rolls Insight
// against the Stealth of each hidden watcher: someone opposed or hostile to the owner (LI6 b), aware of it, with sight
// of it at any distance (RD3), whom the owner has not seen or heard. A win is a hunch from the watcher's zone, never who:
// the owner turns suspicious of the watcher there. Each watcher sets it off at most once a scenario, and is rolled against
// at most once every HUNCH_EVERY_ROUNDS rounds of game time (AT74).
import type { Actor, ContestResult, GameState, Rng } from '../types';
import { hasPerk, markUse, ruleset } from '../ruleset';
import { PK } from '../library/perkIds';
import { SK } from '../library/skillIds';
import { allActors, atLeast, isActive, shortestPath, wary } from './relations';
import { beliefStatus } from '../perception';
import { stealthSkill } from '../minds/state';
import { contestFeat } from './feats';
import { CONFIG } from '../config';
import { secondsSince } from '../time';

export type Hunch = { owner: Actor; watcher: Actor; contest: ContestResult; felt: boolean };

/** someone watching `owner` unseen who means it harm: opposed or hostile to it, aware of it and in sight of it, and the
 * owner is unaware of them */
export function hiddenWatcher(state: GameState, owner: Actor, w: Actor): boolean {
  if (w.id === owner.id || !isActive(w) || (!!w.bandId && w.bandId === owner.bandId) || !wary(state, w, owner)) return false;
  if (!atLeast(beliefStatus(state, w, owner), 'aware')) return false;
  const path = shortestPath(state, w.zone, owner.zone, true);
  return !!path && beliefStatus(state, owner, w) === 'unaware'; // RD3: any distance, as long as the watcher has sight of the owner
}

/** the turn's Gut Feeling rolls, every owner against each hidden watcher that hasn't set it off this scenario */
export function gutFeelings(state: GameState, rng: Rng): Hunch[] {
  const out: Hunch[] = [];
  const scenario = state.stage.scenarioStartTurn;
  for (const owner of allActors(state)) {
    if (!isActive(owner) || !hasPerk(owner, PK.gut_feeling)) continue;
    if (owner.hunches?.scenario !== scenario) owner.hunches = { scenario, ids: [] };
    for (const w of allActors(state)) {
      if (owner.hunches.ids.includes(w.id) || !hiddenWatcher(state, owner, w)) continue;
      if (secondsSince(state, owner.hunches.tried?.[w.id]) < CONFIG.HUNCH_EVERY_ROUNDS * CONFIG.ROUND_S) continue;
      (owner.hunches.tried ??= {})[w.id] = state.turn;
      const contest = ruleset.contested(
        { actorId: w.id, skill: stealthSkill(w), modifiers: [], tierShifts: [], rollKind: 'stealth' },
        { actorId: owner.id, skill: SK.insight, modifiers: [], tierShifts: [], against: w.id }, state, rng);
      markUse(state, owner, contest.b.skill, contest);
      markUse(state, w, contest.a.skill, contest);
      contestFeat(state, contest);
      const felt = contest.gap > 0;
      if (felt) owner.hunches.ids.push(w.id);
      out.push({ owner, watcher: w, contest, felt });
    }
  }
  return out;
}
