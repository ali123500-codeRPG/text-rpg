// Auras (NT14, MB19, MB36–MB39; Intimidation aura doc I1–I8). An aura is a perk-granted function of one skill. Each kind
// has its own trigger: an engagement aura checks each opposed-or-worse target once per engagement, the first time the
// target is aware of the owner within reach (auraReachM: CONFIG.AURA_REACH_M metres, more with Chorus; by distM). The target rolls its morale
// skill (Resolve, with renown) against the owner's aura skill; when the owner wins, the target takes the aura's effect
// and pays the aura's fear per tier of gap. Several auras check and cost on their own, so their morale costs add up.
//   Dread Presence (Intimidation 100): Shaken toward the owner by SHAKEN_PER_TIER × gap until the engagement ends (the
//   bigger of aura and spoken Shaken stands), and FR.dread_presence (10 morale per tier).
import type { Actor, ContestResult, GameEvent, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { hasPerk, markUse, moraleRoll, ruleset, toContest } from '../ruleset';
import { FN } from '../library/functionIds';
import { PK } from '../library/perkIds';
import { SK } from '../library/skillIds';
import { CP, FR } from '../library/tableIds';
import { calm } from './heal';
import { allActors, atLeast, isActive, onSightPerks, stance, wary } from './relations';
import { STANCES } from '../scales';
import { probe } from './yield';
import { distM, withinM } from './position';
import { besidePlayer } from './engagement';
import { perceptionOf } from '../perception';
import { AURAS, type AuraDef } from '../library/auras';
import { applySpeech } from './speech';
import { contestFeat } from './feats';
import { maxMorale } from '../ruleset/morale';
import { payoffShare, themeCount } from '../ruleset/perks';

export { AURAS, type AuraDef } from '../library/auras';

const key = (aura: AuraDef, owner: Actor) => `${aura.perk}:${owner.id}`;

/** the target is in reach of the owner's engagement aura: opposed or hostile to it, aware of it, and close enough */
function inReach(state: GameState, owner: Actor, t: Actor): boolean {
  if (t === owner || !isActive(t) || !wary(state, t, owner)) return false;
  if (!atLeast(t.mind?.knowledge?.[owner.id]?.status, 'aware')) return false;
  return withinM(distM(state, owner, t), auraReachM(owner));
}
/** an owner's engagement-aura reach in metres: AURA_REACH_M; with Chorus (CN8, Intimidation 120) each shout piece, Chorus
 * included, adds CHORUS_REACH_M in full, and the reach grows by the payoff share of those pieces */
export function auraReachM(owner: Actor): number {
  if (!hasPerk(owner, PK.chorus)) return CONFIG.AURA_REACH_M;
  const n = themeCount(owner, 'shout');
  return CONFIG.AURA_REACH_M * (1 + payoffShare(n)) + CONFIG.CHORUS_REACH_M * n;
}

export type AuraCheck = { owner: Actor; target: Actor; aura: AuraDef; contest: ContestResult; took: boolean; overwhelmed?: true };
export type AuraFear = (a: Actor, id: string, gap?: number, overwhelm?: boolean) => void;

/** MR2–MR4 Overwhelm (Resolve 100): any of the owner's auras that wins by OVERWHELM_TIERS or more against a target whose
 * max morale is at most OVERWHELM_MORALE_SHARE of the owner's breaks the target at once, and it surrenders */
export const overwhelms = (owner: Actor, t: Actor, c: ContestResult): boolean =>
  c.winner === 'a' && hasPerk(owner, PK.overwhelm) && -c.gap >= CONFIG.OVERWHELM_TIERS && maxMorale(t) <= CONFIG.OVERWHELM_MORALE_SHARE * maxMorale(owner);

/** one aura's or cry's contest: the owner's `skill` against the target's morale roll; both sides mark (I8, like any
 * contest). The owner takes it on a win; whether it also overwhelms (the caller pays the fear) */
function auraContest(state: GameState, owner: Actor, t: Actor, skill: string, rng: Rng): { contest: ContestResult; took: boolean; ow: boolean } {
  const contest = toContest(ruleset.roll({ actorId: owner.id, skill, modifiers: [], tierShifts: [], against: t.id, contest: true }, state, rng), moraleRoll(state, t, rng, 0, [], true));
  markUse(state, owner, contest.a.skill, contest);
  markUse(state, t, contest.b.skill, contest);
  contestFeat(state, contest);
  return { contest, took: contest.winner === 'a', ow: overwhelms(owner, t, contest) };
}

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
        const { contest, took, ow } = auraContest(state, owner, t, aura.skill, rng);
        if (took && aura.shaken) applySpeech(owner, t, 'intimidate', contest); // I6: the bigger Shaken stands
        if (took) fear(t, aura.fear, contest.gap, ow);
        out.push({ owner, target: t, aura, contest, took, ...(ow ? { overwhelmed: true as const } : {}) });
      }
    }
  }
  return out;
}

/** Dreaded on Sight (PerkDef.onSight): at the start of each turn, everyone outside the owner's band who sees the owner
 * for the first time pays the quirk's fear, and from then on reads its band's stance toward the owner colder
 * (relations.ts stance()). Once per owner, for good. Returns who met whom. */
export function sightDread(state: GameState, fear: AuraFear): { owner: Actor; target: Actor; perk: string }[] {
  const out: { owner: Actor; target: Actor; perk: string }[] = [];
  for (const owner of allActors(state)) {
    if (!isActive(owner)) continue;
    for (const d of onSightPerks(owner)) {
      const k = `${d.id}:${owner.id}`;
      for (const t of allActors(state)) {
        if (t === owner || !isActive(t) || t.sightChecks?.includes(k) || (!!t.bandId && t.bandId === owner.bandId)) continue;
        if (probe(state, t, owner, 'silent', 'normal')?.cue !== 'sight') continue;
        (t.sightChecks ??= []).push(k);
        fear(t, d.onSight!.fear);
        out.push({ owner, target: t, perk: d.id });
      }
    }
  }
  return out;
}

export type CryResult = { target: Actor; contest?: ContestResult; took?: boolean; rallied?: true; overwhelmed?: true };

/** an ally of the owner for Battle Cry: a bandmate, someone who counts the owner a friend or better, or (for the player)
 * someone fighting beside them */
export function cryAlly(state: GameState, t: Actor, owner: Actor): boolean {
  const s = stance(state, t, owner);
  return (!!t.bandId && t.bandId === owner.bandId) || (s !== 'yielded' && STANCES.pos(s) >= STANCES.pos('friend')) || (owner === state.player && besidePlayer(state, t));
}

/** TM28: a battle cry's rally restores morale through the composure table (CP.rallied), unless the actor already broke */
const rally = (state: GameState, a: Actor): void => { if (isActive(a) && !a.mind?.moraleState) calm(state, a, CP.rallied); };

/** I9/MB27 Battle Cry (Intimidation 140), an offensive aura triggered by its move: the owner's roar (`ev`, a Loud event)
 * reaches everyone who perceives it at any level, however far. Each foe (opposed or hostile to the owner) rolls its
 * morale skill (Resolve) against the owner's Intimidation and pays FR.battle_cry per tier of gap when it loses. Each
 * ally, and the owner, gets the composure row CP.rallied (10 morale back, TM28) and loses any Shaken. */
export function battleCry(state: GameState, owner: Actor, ev: GameEvent, rng: Rng, fear: AuraFear): CryResult[] {
  const out: CryResult[] = [];
  // the roar rallies the one who roars as it rallies their allies
  rally(state, owner);
  for (const p of Object.values(owner.pressure ?? {})) delete p.shaken;
  out.push({ target: owner, rallied: true });
  for (const t of allActors(state)) {
    if (t === owner || !isActive(t) || !(ev.perception[t.id] ?? perceptionOf(ev, state, t))) continue;
    if (wary(state, t, owner)) {
      const { contest, took, ow } = auraContest(state, owner, t, SK.intimidation, rng);
      if (took) fear(t, FR.battle_cry, contest.gap, ow);
      out.push({ target: t, contest, took, ...(ow ? { overwhelmed: true as const } : {}) });
    } else if (cryAlly(state, t, owner)) {
      rally(state, t);
      for (const p of Object.values(t.pressure ?? {})) delete p.shaken;
      out.push({ target: t, rallied: true });
    }
  }
  return out;
}
