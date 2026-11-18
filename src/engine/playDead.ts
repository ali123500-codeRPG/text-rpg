// Play Dead (TC32 a, TC44-TC48; Guile 20; rules in src/library/perks.ts).
//   TC44 a: a blow that leaves the owner Wounded or worse but not Down opens the move until the end of its next turn; the
//   move is the turn's main action (resolve.ts doPlayDead).
//   Each foe that sees the owner clearly rolls its answer to a lie (Insight) against the owner's Guile; one that does not win
//   outright takes the owner for Down (its views show it lying Down: views/index.ts), and believes it on its own (TC48 a).
//   TC47 a: a foe that first sees the owner clearly later rolls the same check. TC46 a: a believer within grip reach rolls
//   again, once a turn. TC45 a: the owner defending against any blow ends it for every foe; so does any act or move of its own.
//   The owner's first attack on a believer counts as on an unaware foe (resolve.ts doAttack).
import type { Actor, Effect, GameState, Rng } from '../types';
import { hasPerk, healthLevel, isDownLevel, markUse, ruleset, toContest } from '../ruleset';
import { HEALTH_LEVELS } from '../scales';
import { SK } from '../library/skillIds';
import { PK } from '../library/perkIds';
import { allActors, foe, isActive } from './relations';
import { contestFeat } from './feats';
import { answerRoll, answerSkill } from './speech';
import { withinGrip } from './position';
import { seesClearlyNow } from '../views';
import { sawThrough, warnedShift, type Trick } from './ruses';

/** TC44 a: a blow left it Wounded or worse but not Down: the move opens for this turn and the next */
export function openPlayDead(state: GameState, a: Actor): void {
  const h = healthLevel(a);
  if (hasPerk(a, PK.play_dead) && !a.playingDead && HEALTH_LEVELS.pos(h) >= HEALTH_LEVELS.pos('wounded') && !isDownLevel(h)) a.playDeadOpen = state.turn;
}
/** the move can be used now */
export const playDeadOpen = (state: GameState, a: Actor): boolean => a.playDeadOpen !== undefined && state.turn - a.playDeadOpen <= 1 && !a.playingDead;

/** x takes a for Down (it lost its roll against a's Play Dead) */
export const fooledBy = (x: Actor, a: Actor | undefined): boolean => !!a?.playingDead?.believers.includes(x.id);

/** the foes who could be fooled: active, awake foes on either side, that see the owner clearly now */
export const watchers = (state: GameState, a: Actor): Actor[] => allActors(state)
  .filter((x) => x !== a && isActive(x) && !x.asleep && (foe(state, x, a) || foe(state, a, x)) && seesClearlyNow(state, x, a.id))
  .sort((x, y) => x.id.localeCompare(y.id));

/** a lie told with the body (Play Dead, S3 feigned flight): the owner's Guile against the foe's answer to a lie; the foe
 * must win outright to see through it, WARNED_SHIFT tiers better if it knows the trick (WN3, WN11). One that sees through
 * knows it from now on, and on its own look (`own`) may warn its allies (WN8). True: the foe is fooled */
export function bodyLie(state: GameState, a: Actor, x: Actor, rng: Rng, t: Trick, own = true): boolean {
  const c = toContest(ruleset.roll({ actorId: a.id, skill: SK.guile, modifiers: [], tierShifts: [], against: x.id, contest: true }, state, rng), answerRoll(state, x, answerSkill('deceive'), a.id, rng, warnedShift(x, a.id, t)));
  markUse(state, a, c.a.skill, c);
  contestFeat(state, c);
  markUse(state, x, c.b.skill, c);
  if (c.winner === 'b') sawThrough(state, x, a, t, own);
  return c.winner !== 'b';
}

/** one foe's roll against the act */
function judge(state: GameState, a: Actor, x: Actor, rng: Rng, own = true): Effect {
  const pd = a.playingDead!;
  const fooled = bodyLie(state, a, x, rng, 'play_dead', own);
  if (!pd.judged.includes(x.id)) pd.judged = [...pd.judged, x.id].sort();
  pd.believers = fooled ? [...new Set([...pd.believers, x.id])].sort() : pd.believers.filter((id) => id !== x.id);
  return { kind: fooled ? 'play_dead_fooled' : 'play_dead_seen_through', actorId: x.id, data: { by: a.id, perk: PK.play_dead } };
}

/** WN3 a: a believer that was warned looks again, knowing the trick (not news of its own to pass on) */
export const rejudgePlayDead = (state: GameState, a: Actor, x: Actor, rng: Rng): Effect => judge(state, a, x, rng, false);

/** the owner drops: every foe that sees it clearly rolls */
export function startPlayDead(state: GameState, a: Actor, rng: Rng): Effect[] {
  delete a.playDeadOpen;
  a.playingDead = { believers: [], judged: [] };
  return watchers(state, a).map((x) => judge(state, a, x, rng));
}

/** the act is over for every foe (the owner acted, moved or defended); returns who still believed it */
export function endPlayDead(a: Actor): string[] {
  const was = a.playingDead?.believers ?? [];
  delete a.playingDead;
  return was;
}

/** each turn's end: a newcomer that sees the owner clearly rolls (TC47 a), a believer within grip reach rolls again (TC46 a).
 * Returns, per owner, the effects of the rolls made. The act ends when the owner is really Down. */
export function playDeadChecks(state: GameState, rng: Rng): { owner: Actor; effects: Effect[] }[] {
  const out: { owner: Actor; effects: Effect[] }[] = [];
  for (const a of allActors(state)) {
    if (a.playDeadOpen !== undefined && state.turn - a.playDeadOpen > 1) delete a.playDeadOpen;
    if (!a.playingDead) continue;
    if (!isActive(a)) { delete a.playingDead; continue; }
    const effects: Effect[] = [];
    for (const x of watchers(state, a)) {
      const fresh = !a.playingDead.judged.includes(x.id);
      if (fresh || (a.playingDead.believers.includes(x.id) && withinGrip(state, x, a))) effects.push(judge(state, a, x, rng));
    }
    if (effects.length) out.push({ owner: a, effects });
  }
  return out;
}
