// Auras (NT14, MB19, MB36–MB39; Intimidation aura doc I1–I8). An aura is a perk-granted function of one skill. Each kind
// has its own trigger: an engagement aura checks each opposed-or-worse target once per engagement, the first time the
// target is aware of the owner within reach (auraReachM: grows with the aura skill, more with Chorus; by distM). The target rolls its morale
// skill (Resolve, with renown) against the owner's aura skill; when the owner wins, the target takes the aura's effect
// and pays the aura's fear per tier of gap. Several auras check and cost on their own, so their morale costs add up.
//   Dread Presence (Intimidation 100): Shaken toward the owner by SHAKEN_PER_TIER × gap until the engagement ends (the
//   bigger of aura and spoken Shaken stands), and FR.dread_presence (10 morale per tier).
import type { Actor, ContestResult, GameEvent, GameState, Rng, RollResult } from '../types';
import { CONFIG } from '../config';
import { hasPerk, markUse, moraleRoll, ruleset, tierLevel, toContest, trueSkill } from '../ruleset';
import { FN } from '../library/functionIds';
import { PK } from '../library/perkIds';
import { SK } from '../library/skillIds';
import { CP, FR } from '../library/tableIds';
import { calm } from './heal';
import { allActors, atLeast, atLeastStance, isActive, onSightPerks, stance, wary } from './relations';
import { STANCES, TIERS } from '../scales';
import { probe } from './yield';
import { distM, withinM, placeOf } from './position';
import { besidePlayer } from './engagement';
import { hears, perceptionOf } from '../perception';
import { AURAS, type AuraDef } from '../library/auras';
import { applySpeech } from './speech';
import { contestFeat } from './feats';
import { maxMorale, moraleLost } from '../ruleset/morale';
import { payoffShare, themeCount } from '../ruleset/perks';
import { augmentK } from '../ruleset/gear';
import { skillName } from '../library/skillNames';

export { AURAS, type AuraDef } from '../library/auras';

const key = (aura: AuraDef, owner: Actor) => `${aura.perk}:${owner.id}`;

/** the target is in reach of the owner's engagement aura: opposed or hostile to it, aware of it, and close enough */
function inReach(state: GameState, owner: Actor, t: Actor, skill: string): boolean {
  if (t === owner || !isActive(t) || !wary(state, t, owner)) return false;
  if (!atLeast(t.mind?.knowledge?.[owner.id]?.status, 'aware')) return false;
  return withinM(distM(state, owner, t), auraReachM(owner, skill));
}
/** D-193 (RD9): an aura's base reach in metres grows with the square root of its skill:
 * AURA_REACH_M × √(true skill ÷ AURA_REACH_SKILL), so the skill an aura perk opens at gives AURA_REACH_M */
export const baseAuraReachM = (owner: Actor, skill: string): number =>
  CONFIG.AURA_REACH_M * Math.sqrt(Math.max(0, trueSkill(owner, skill)) / CONFIG.AURA_REACH_SKILL);
/** an owner's aura reach in metres for an aura of `skill` (baseAuraReachM); with Chorus (CN8, Intimidation 120) each shout
 * piece, Chorus included, adds CHORUS_REACH_M in full, and the reach grows by the payoff share of those pieces */
export function auraReachM(owner: Actor, skill: string): number {
  const base = baseAuraReachM(owner, skill);
  if (!hasPerk(owner, PK.chorus)) return base;
  const n = themeCount(owner, 'shout');
  return base * (1 + payoffShare(n)) + CONFIG.CHORUS_REACH_M * n;
}

/** TC37/TC38: a projected aura reaches whoever perceives it at any level, or anyone within PROJECTED_AURA_MULT × the
 * owner's aura reach (heard or not) */
export function projectedReachM(owner: Actor, skill: string): number {
  return CONFIG.PROJECTED_AURA_MULT * auraReachM(owner, skill);
}

export type AuraCheck = { owner: Actor; target: Actor; aura: AuraDef; contest: ContestResult; took: boolean; overwhelmed?: true };
export type AuraFear = (a: Actor, id: string, gap?: number, overwhelm?: boolean, mult?: number) => void;
/** LG12 Fear Bites Deeper (Intimidation 40): morale the owner makes others lose is ×FEAR_BITES_MULT */
export const fearMult = (owner: Actor): number => (hasPerk(owner, PK.fear_bites_deeper) ? CONFIG.FEAR_BITES_MULT : 1);

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
        if (t.auraChecks?.includes(key(aura, owner)) || !inReach(state, owner, t, aura.skill)) continue;
        (t.auraChecks ??= []).push(key(aura, owner));
        const { contest, took, ow } = auraContest(state, owner, t, aura.skill, rng);
        if (took && aura.shaken) applySpeech(owner, t, 'intimidate', contest); // I6: the bigger Shaken stands
        if (took) fear(t, aura.fear, contest.gap, ow, fearMult(owner));
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
        fear(t, d.onSight!.fear, undefined, undefined, fearMult(owner));
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
  return (!!t.bandId && t.bandId === owner.bandId) || atLeastStance(s, 'friend') || (owner === state.player && besidePlayer(state, t));
}

/** TC43 a: a rally is one roll by the one rallied: its morale check (Resolve) plus RALLY_SHARE of the rallier's rallying
 * skill (Battle Cry: Intimidation; Rally later: Command) through the augment equation, added to the skill like any
 * augment (× SKILL_WEIGHT on the roll). Each tier above Near Miss gives the composure row CP.rallied's points (10) back,
 * so a steadier ally and a stronger voice both help, and the ally's own morale penalty still counts.
 * BG-301 (TC42 a): it reaches broken allies too; back under 100 % of max morale lost, the break ends (liftBreak); a
 * spoken surrender stays. TC41 a: a rally that gives anything back makes the actor Rallied (CONFIG.RALLIED_MOD on every
 * roll) for the rest of the fight, no stacking. */
export function rallyRoll(state: GameState, a: Actor, by: Actor, skill: string, rng: Rng): { roll: RollResult; tiers: number } {
  const help = CONFIG.SKILL_WEIGHT * trueSkill(by, skill) * augmentK(by, { share: CONFIG.RALLY_SHARE }, skill, SK.resolve);
  const roll = moraleRoll(state, a, rng, 0, help ? [{ source: `rallied by ${skillName(skill)}`, type: 'situational', value: help }] : []);
  return { roll, tiers: Math.max(0, tierLevel(roll) - TIERS.pos('near_miss')) };
}
const rally = (state: GameState, a: Actor, by: Actor, skill: string, rng: Rng): number => {
  if (!isActive(a)) return 0;
  const { tiers } = rallyRoll(state, a, by, skill, rng);
  if (tiers) {
    calm(state, a, CP.rallied, { times: tiers });
    if (a.engagement) a.engagement.rallied = true;
  }
  liftBreak(state, a);
  return tiers;
};

/** BG-301: a broken actor whose morale lost is back under 100 % of max is no longer broken: it stops yielding to those
 * it was fighting (loseNerve set them to yielded) and fights on. A spoken surrender (moraleState 'surrendered') stays. */
export function liftBreak(state: GameState, a: Actor): boolean {
  const m = a.mind;
  if (m?.moraleState !== 'broken' || moraleLost(a) >= maxMorale(a)) return false;
  delete m.moraleState;
  for (const [id, st] of Object.entries(m.overrides ?? {})) if (st === 'yielded') m.overrides![id] = 'hostile';
  return true;
}

/** TC37/TC38 b: a projected aura's shout (`ev`) reaches whoever perceives it at any level, or anyone within the projected reach */
const projectedReaches = (state: GameState, owner: Actor, ev: GameEvent, t: Actor, skill: string): boolean =>
  !!(ev.perception[t.id] ?? perceptionOf(ev, state, t)) || withinM(distM(state, owner, t), projectedReachM(owner, skill));

/** TC39 a Rally (Command 100), a projected aura triggered by its move: each ally the call reaches (projectedReaches; not a
 * foe, not the owner) makes the rally roll with the owner's Command (rallyRoll): morale back per tier above Near Miss, the
 * Rallied buff, and a break lifted once morale lost is back under max. Returns the tiers each ally got. */
export function rallyCall(state: GameState, owner: Actor, ev: GameEvent, rng: Rng): { target: Actor; tiers: number }[] {
  const out: { target: Actor; tiers: number }[] = [];
  for (const t of allActors(state)) {
    if (t === owner || !isActive(t) || wary(state, t, owner) || !cryAlly(state, t, owner) || !projectedReaches(state, owner, ev, t, SK.command)) continue;
    out.push({ target: t, tiers: rally(state, t, owner, SK.command, rng) });
  }
  return out;
}

/** TC55 a: before calling, whether a Rally would reach `t`: an ally (as rallyCall counts one) that would hear the Loud call
 * from where the owner stands, or stands within the projected reach */
export const rallyWouldReach = (state: GameState, owner: Actor, t: Actor): boolean =>
  t !== owner && isActive(t) && !wary(state, t, owner) && cryAlly(state, t, owner)
  && (hears(state, t, placeOf(owner), 'loud') || withinM(distM(state, owner, t), projectedReachM(owner, SK.command)));

/** I9/MB27 Battle Cry (Intimidation 140), a projected aura triggered by its move: the owner's roar (`ev`, a Loud event)
 * reaches everyone who perceives it at any level, however far, and anyone within the projected reach (projectedReachM),
 * heard or not. Each foe (opposed or hostile to the owner) rolls its
 * morale skill (Resolve) against the owner's Intimidation and pays FR.battle_cry per tier of gap when it loses. Each
 * ally, and the owner, gets the composure row CP.rallied (10 morale back, TM28) and loses any Shaken. */
export function battleCry(state: GameState, owner: Actor, ev: GameEvent, rng: Rng, fear: AuraFear): CryResult[] {
  const out: CryResult[] = [];
  // the roar rallies the one who roars as it rallies their allies
  rally(state, owner, owner, SK.intimidation, rng);
  for (const p of Object.values(owner.pressure ?? {})) delete p.shaken;
  out.push({ target: owner, rallied: true });
  for (const t of allActors(state)) {
    if (t === owner || !isActive(t)) continue;
    if (!projectedReaches(state, owner, ev, t, SK.intimidation)) continue;
    if (wary(state, t, owner)) {
      const { contest, took, ow } = auraContest(state, owner, t, SK.intimidation, rng);
      if (took) fear(t, FR.battle_cry, contest.gap, ow, fearMult(owner));
      out.push({ target: t, contest, took, ...(ow ? { overwhelmed: true as const } : {}) });
    } else if (cryAlly(state, t, owner)) {
      rally(state, t, owner, SK.intimidation, rng);
      for (const p of Object.values(t.pressure ?? {})) delete p.shaken;
      out.push({ target: t, rallied: true });
    }
  }
  return out;
}
