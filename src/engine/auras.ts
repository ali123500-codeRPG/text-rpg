// Auras (NT14, MB19, MB36–MB39; Intimidation aura doc I1–I8). An aura is a perk-granted function of one skill. Each kind
// has its own trigger: an engagement aura checks each opposed-or-worse target once per engagement, the first time the
// target is aware of the owner within reach (the owner's zone and CONFIG.AURA_REACH links). The target rolls its morale
// skill (Resolve, with renown) against the owner's aura skill; when the owner wins, the target takes the aura's effect
// and pays the aura's fear per tier of gap. Several auras check and cost on their own, so their morale costs add up.
//   Dread Presence (Intimidation 100): Shaken toward the owner by SHAKEN_PER_TIER × gap until the engagement ends (the
//   bigger of aura and spoken Shaken stands), and FR.dread_presence (10 morale per tier).
import type { Actor, ContestResult, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { hasPerk, markUse, moraleRoll, ruleset } from '../ruleset';
import { FN } from '../library/functionIds';
import { PK } from '../library/perkIds';
import { SK } from '../library/skillIds';
import { FR } from '../library/tableIds';
import { allActors, atLeast, isActive, shortestPath, wary } from './relations';
import { applySpeech, toContest } from './speech';
import { contestFeat } from './feats';

export type AuraDef = { perk: string; fn: string; skill: string; fear: string; shaken?: true };
/** every aura in the game, keyed by its perk; a new aura is one row */
export const AURAS: AuraDef[] = [
  { perk: PK.dread_presence, fn: FN.engagement_aura, skill: SK.intimidation, fear: FR.dread_presence, shaken: true },
];

const key = (aura: AuraDef, owner: Actor) => `${aura.perk}:${owner.id}`;

/** the target is in reach of the owner's engagement aura: opposed or hostile to it, aware of it, and close enough */
function inReach(state: GameState, owner: Actor, t: Actor): boolean {
  if (t === owner || !isActive(t) || !wary(state, t, owner)) return false;
  if (!atLeast(t.mind?.knowledge?.[owner.id]?.status, 'aware')) return false;
  const path = t.zone === owner.zone ? [] : shortestPath(state, owner.zone, t.zone);
  return !!path && path.length <= CONFIG.AURA_REACH;
}

export type AuraCheck = { owner: Actor; target: Actor; aura: AuraDef; contest: ContestResult; took: boolean };

/** I4: at the start of each turn, every engagement aura checks each target that qualifies for the first time this
 * engagement. `fear` pays the morale cost (resolve.ts, so a break is handled as any other). */
export function engagementAuras(state: GameState, rng: Rng, fear: (a: Actor, id: string, gap: number) => void): AuraCheck[] {
  const out: AuraCheck[] = [];
  for (const owner of allActors(state)) {
    if (!isActive(owner)) continue;
    for (const aura of AURAS) {
      if (aura.fn !== FN.engagement_aura || !hasPerk(owner, aura.perk)) continue;
      for (const t of allActors(state)) {
        if (t.auraChecks?.includes(key(aura, owner)) || !inReach(state, owner, t)) continue;
        (t.auraChecks ??= []).push(key(aura, owner));
        const contest = toContest(ruleset.roll({ actorId: owner.id, skill: aura.skill, modifiers: [], tierShifts: [], against: t.id }, state, rng), moraleRoll(state, t, rng));
        markUse(state, owner, contest.a.skill, contest); // I8: both sides mark, like any contest
        markUse(state, t, contest.b.skill, contest);
        contestFeat(state, contest);
        const took = contest.winner === 'a';
        if (took && aura.shaken) applySpeech(owner, t, 'intimidate', contest); // I6: the bigger Shaken stands
        if (took) fear(t, aura.fear, contest.gap);
        out.push({ owner, target: t, aura, contest, took });
      }
    }
  }
  return out;
}
