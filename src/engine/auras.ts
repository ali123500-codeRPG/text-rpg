// Auras (NT14, MB19, MB36–MB39; Intimidation aura doc I1–I8). An aura is a perk-granted function of one skill. Each kind
// has its own trigger: an engagement aura checks each opposed-or-worse target once per engagement, the first time the
// target is aware of the owner within reach (CONFIG.AURA_REACH_M metres, by distM). The target rolls its morale
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
import { allActors, atLeast, isActive, shortestPath, stance, wary } from './relations';
import { distM } from './position';
import { besidePlayer } from './engagement';
import { perceptionOf } from '../perception';
import type { GameEvent } from '../types';
import { AURAS, type AuraDef } from '../library/auras';
import { applySpeech, toContest } from './speech';
import { contestFeat } from './feats';
import { maxMorale } from '../ruleset/morale';

export { AURAS, type AuraDef } from '../library/auras';

const key = (aura: AuraDef, owner: Actor) => `${aura.perk}:${owner.id}`;

/** the target is in reach of the owner's engagement aura: opposed or hostile to it, aware of it, and close enough */
function inReach(state: GameState, owner: Actor, t: Actor): boolean {
  if (t === owner || !isActive(t) || !wary(state, t, owner)) return false;
  if (!atLeast(t.mind?.knowledge?.[owner.id]?.status, 'aware')) return false;
  return distM(state, owner, t) <= CONFIG.AURA_REACH_M;
}

export type AuraCheck = { owner: Actor; target: Actor; aura: AuraDef; contest: ContestResult; took: boolean; overwhelmed?: true };
export type AuraFear = (a: Actor, id: string, gap?: number, overwhelm?: boolean) => void;

/** MR2–MR4 Overwhelm (Resolve 100): any of the owner's auras that wins by OVERWHELM_TIERS or more against a target whose
 * max morale is at most OVERWHELM_MORALE_SHARE of the owner's breaks the target at once, and it surrenders */
export const overwhelms = (owner: Actor, t: Actor, c: ContestResult): boolean =>
  c.winner === 'a' && hasPerk(owner, PK.overwhelm) && -c.gap >= CONFIG.OVERWHELM_TIERS && maxMorale(t) <= CONFIG.OVERWHELM_MORALE_SHARE * maxMorale(owner);

/** I4: at the start of each turn, every engagement aura checks each target that qualifies for the first time this
 * engagement. `fear` pays the morale cost (resolve.ts, so a break is handled as any other). */
export function engagementAuras(state: GameState, rng: Rng, fear: AuraFear): AuraCheck[] {
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
        const ow = overwhelms(owner, t, contest);
        if (took) fear(t, aura.fear, contest.gap, ow);
        out.push({ owner, target: t, aura, contest, took, ...(ow ? { overwhelmed: true as const } : {}) });
      }
    }
  }
  return out;
}

export type CryResult = { target: Actor; contest?: ContestResult; took?: boolean; rallied?: true; overwhelmed?: true };

/** an ally of the owner for Battle Cry: a bandmate, someone who counts the owner a friend or better, or (for the player)
 * someone fighting beside them */
export const cryAlly = (state: GameState, t: Actor, owner: Actor): boolean =>
  (!!t.bandId && t.bandId === owner.bandId) || ['friend', 'loyal'].includes(stance(state, t, owner)) || (owner === state.player && besidePlayer(state, t));

/** I9/MB27 Battle Cry (Intimidation 140), an offensive aura triggered by its move: the owner's roar (`ev`, a Loud event)
 * reaches everyone who perceives it at any level, however far. Each foe (opposed or hostile to the owner) rolls its
 * morale skill (Resolve) against the owner's Intimidation and pays FR.battle_cry per tier of gap when it loses. Each
 * ally, and the owner, gets FR.rallied (10 morale back) and loses any Shaken. */
export function battleCry(state: GameState, owner: Actor, ev: GameEvent, rng: Rng, fear: AuraFear): CryResult[] {
  const out: CryResult[] = [];
  // the roar rallies the one who roars as it rallies their allies
  fear(owner, FR.rallied);
  for (const p of Object.values(owner.pressure ?? {})) delete p.shaken;
  out.push({ target: owner, rallied: true });
  for (const t of allActors(state)) {
    if (t === owner || !isActive(t) || !(ev.perception[t.id] ?? perceptionOf(ev, state, t))) continue;
    if (wary(state, t, owner)) {
      const contest = toContest(ruleset.roll({ actorId: owner.id, skill: SK.intimidation, modifiers: [], tierShifts: [], against: t.id }, state, rng), moraleRoll(state, t, rng));
      markUse(state, owner, contest.a.skill, contest);
      markUse(state, t, contest.b.skill, contest);
      contestFeat(state, contest);
      const took = contest.winner === 'a';
      const ow = overwhelms(owner, t, contest);
      if (took) fear(t, FR.battle_cry, contest.gap, ow);
      out.push({ target: t, contest, took, ...(ow ? { overwhelmed: true as const } : {}) });
    } else if (cryAlly(state, t, owner)) {
      fear(t, FR.rallied);
      for (const p of Object.values(t.pressure ?? {})) delete p.shaken;
      out.push({ target: t, rallied: true });
    }
  }
  return out;
}
