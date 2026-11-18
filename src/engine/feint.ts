// S3 Feigned flight (TC19 a, TC24 a, TC50-TC52 a; Stratagem 70, a code-run fight row: minds/routines.ts tacticsOrder).
//   Outnumbered, not hurt badly and not broken, the NPC runs as if broken, once a fight. Each foe that sees it clearly rolls
//   its answer to a lie (Insight) against its Guile (bodyLie); one that does not win outright believes the flight (TC52 a:
//   its views show it broken; its own band is never fooled, and its own morale is untouched).
//   TC50 a: while it runs, a believer that comes within one move of it, with no other foe within one move of that believer,
//   is turned on and struck; the feint ends after CONFIG.FEINT_S of game time with no such follower.
//   TC51 a: that blow lands as on an unaware foe (resolve.ts doAttack).
import type { Actor, Effect, GameState, Rng } from '../types';
import { CONFIG } from '../config';
import { now } from '../time';
import { bodyLie, watchers } from './playDead';

/** the feint is still on (begun less than FEINT_S ago) */
export const feinting = (state: GameState, a: Actor): boolean => !!a.feint && (now(state) - a.feint.at) * 60 < CONFIG.FEINT_S; // now() is in game minutes
/** x believes a's flight */
export const fooledByFeint = (state: GameState, x: Actor, a: Actor | undefined): boolean => !!a && feinting(state, a) && a.feint!.believers.includes(x.id);

/** the feint begins: every foe that sees it clearly rolls */
export function startFeint(state: GameState, a: Actor, rng: Rng): Effect[] {
  a.feint = { at: now(state), believers: [] };
  return watchers(state, a).map((x) => {
    const fooled = bodyLie(state, a, x, rng, 'feint');
    if (fooled) a.feint!.believers.push(x.id);
    return { kind: fooled ? 'feint_fooled' : 'feint_seen_through', actorId: x.id, data: { by: a.id } };
  });
}

/** each turn's end: a feint past its time, or out of a fight, is over */
export function expireFeint(state: GameState, a: Actor): void {
  if (a.feint && (!feinting(state, a) || !a.engagement)) delete a.feint;
}
