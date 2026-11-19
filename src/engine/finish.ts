// IQ4 a, IQ6 a, IQ7 a: a fight the player far outclasses can be finished in one turn. The action list offers Finish the
// fight while it qualifies; taking it plays the fight round by round on code (the player's attack, everyone else's
// fallback orders) until it ends or something that is not a chore happens.
import type { Actor, GameEvent, GameState, Intent, Rng } from '../types';
import type { TurnInput } from './types';
import { CONFIG } from '../config';
import { isActive } from './relations';
import { yieldHearers } from './yield';
import { power } from './xp';
import { inSenses } from './comingNear';
import { distOrNull } from './position';
import { isBrokenLevel, moraleLevel } from '../ruleset/morale';
import { resolveTurn } from './resolve';
import { fightInSenses } from './mode';

/** IQ6 a: the foes of the player's fight when it is far below them: each foe's power at most OUTCLASS_EACH of the
 * player's and all of them together at most OUTCLASS_ALL of it; null when there is no such fight */
export function farBelow(state: GameState): Actor[] | null {
  const p = state.player;
  if (state.mode !== 'tactical' || !isActive(p) || isBrokenLevel(moraleLevel(p)) || state.yielding || state.mercy) return null;
  const foes = yieldHearers(state);
  if (!foes.length) return null;
  const mine = power(state, p), theirs = foes.map((f) => power(state, f));
  if (theirs.some((x) => x > CONFIG.OUTCLASS_EACH * mine) || theirs.reduce((n, x) => n + x, 0) > CONFIG.OUTCLASS_ALL * mine) return null;
  return foes;
}

/** why a finished fight handed the turn back: over (no foe left), wounded, someone new in the senses, a foe out of the
 * fight still standing (yielded, fled, gone from sight), no longer far below, the player's attack refused, or the cap */
export type FinishStop = 'over' | 'wounded' | 'someone_new' | 'foe_out' | 'no_longer' | 'refused' | 'ended' | 'cap';
/** how the Narrator is told why a finished fight stopped (NarrationView.fightFinished.stop) */
export const FINISH_STOP_WORDS: Record<FinishStop, string> = {
  over: 'the fight is over', wounded: 'the player was hurt', someone_new: 'someone new came into sight or hearing',
  foe_out: 'a foe yielded, fled or slipped out of sight', no_longer: 'the fight is no longer far below the player',
  refused: 'the player could not strike', ended: 'the scenario ended or the player fell', cap: 'it ran long and the player stopped to look',
};

/** IQ4 a: plays the fight on code, a round (one fight turn) at a time. The first round takes this turn's input (its
 * Planner outputs included); later rounds run everyone else on code. Each round the player attacks the foe they last
 * attacked, else the nearest; `attack` turns that into an accepted intent (null: refused). Stops before a round when the
 * fight is over or no longer far below the player, and after one that wounded the player, brought someone new into their
 * senses or left a foe standing outside the fight. */
export function finishFight(state: GameState, input: TurnInput, rng: Rng, attack: (target: string) => Intent | null): { events: GameEvent[]; rounds: number; stop: FinishStop } {
  const p = state.player, events: GameEvent[] = [];
  let target: string | undefined, rounds = 0, first = true;
  const done = (stop: FinishStop) => { (state.scratch ??= {}).fightFinished = { rounds, stop }; return { events, rounds, stop }; };
  while (rounds < CONFIG.FINISH_MAX_ROUNDS) {
    if (!first && !fightInSenses(state)) return done('over');
    const foes = farBelow(state);
    if (!foes) return done(yieldHearers(state).length ? 'no_longer' : 'over');
    const near = (f: Actor) => distOrNull(state, p, f) ?? Infinity;
    const t = foes.find((f) => f.id === target) ?? [...foes].sort((a, b) => near(a) - near(b) || a.id.localeCompare(b.id))[0];
    const intent = attack(t.id);
    if (!intent) return done('refused');
    target = t.id;
    const lost = p.core.condition.hpLostPct, sensed = inSenses(state, p), fighting = new Set(foes.map((f) => f.id));
    const roundInput: TurnInput = first ? { ...input, intent } : { intent, aimed: false, agentOutputs: [], spokespeople: [] };
    events.push(...resolveTurn(state, roundInput, rng));
    rounds++;
    first = false;
    if (state.stage.breakCause || !isActive(p)) return done('ended');
    if (p.core.condition.hpLostPct > lost) return done('wounded');
    if ([...inSenses(state, p)].some((id) => !sensed.has(id) && !fighting.has(id))) return done('someone_new');
    const still = new Set(yieldHearers(state).map((f) => f.id));
    if (foes.some((f) => isActive(f) && !still.has(f.id))) return done('foe_out');
  }
  return done('cap');
}
