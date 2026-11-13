// The player's yield in a real fight (MB40–MB43). In a spar, "I yield" still just leaves the spar (SP5).
// YD1: the yield reaches the foes fighting the player (engaged with them, YD6), and hostile foes who perceive the player
// by any sense (a yield is said aloud, at normal volume) and are fighting someone on the player's side. One run by Claude, of an Intelligent race, decides in its
// next output (acceptYield); the rest ignore it and fight on. An accepted yield is a truce until the scenario ends: neither
// is hostile to the other, neither can attack the other (MB43), and the fight counts as lost (defeated).
// YD2/YD7: a taken yield also covers the taker's bandmates who are together with it (each perceives the other right now)
// and did not refuse it themselves; bandmates apart act as the band's faction and keep fighting. YD3: once everyone who
// heard the yield has taken it, the fight ends (updateEngagements).
import type { Actor, GameEvent, GameState } from '../types';
import { INTELLIGENCE, type NoiseKey, type VisibilityKey } from '../scales';
import { getLibrary } from '../library';
import { perceptionOf } from '../perception';
import { logCode } from './effects';
import { allActors, bandById, countsInFight, hostile, isActive } from './relations';
import { besidePlayer, fightingWith } from './engagement';
export { truce } from './relations';

/** a Claude-run foe of an Intelligent race can take a yield (MB41) */
function canAccept(a: Actor): boolean {
  const mind = a.core.raceId ? getLibrary().races?.[a.core.raceId]?.intelligence : undefined;
  return a.mind?.control === 'agent' && !!mind && INTELLIGENCE.pos(mind) >= INTELLIGENCE.pos('intelligent');
}

/** the observer perceives `who` right now by any sense (sight, sound, and any added later): a sound of this noise
 * from them, and the sight of them, would reach it */
export function perceivesNow(state: GameState, observer: Actor, who: Actor, noise: NoiseKey): boolean {
  return !!probe(state, observer, who, noise, 'normal');
}
/** how the observer would perceive a sound of `noise` and a sight of `visibility` made by `who` where it stands now */
export function probe(state: GameState, observer: Actor, who: Actor, noise: NoiseKey, visibility: VisibilityKey) {
  const e = { id: 'probe', turn: state.turn, actorId: who.id, kind: 'idle', zone: who.zone, ...(who.pos ? { pos: { ...who.pos } } : {}), noise, visibility, perception: {} } as unknown as GameEvent;
  return perceptionOf(e, state, observer);
}

/** YD7: two bandmates are together while each perceives the other just being there (in sight, or close enough to hear
 * a faint sound); apart, they act as the band's faction: same friends and enemies, but a deal made on the spot binds
 * only those together */
export const together = (state: GameState, a: Actor, b: Actor): boolean =>
  a.bandId === b.bandId && perceivesNow(state, a, b, 'faint') && perceivesNow(state, b, a, 'faint');

/** YD1: who hears the player's yield: foes fighting the player, and hostile foes who perceive the player and fight the player's side */
export function yieldHearers(state: GameState): Actor[] {
  const p = state.player;
  const side = allActors(state).filter((o) => besidePlayer(state, o));
  return state.actors.filter((a) => isActive(a) && countsInFight(a) && hostile(state, a, p)
    && (fightingWith(state, a, p) || (perceivesNow(state, a, p, 'normal') && side.some((o) => fightingWith(state, a, o)))));
}

/** MB40: the player yields to every foe that hears it (YD1) and has not answered an earlier yield this scenario */
export function playerYields(state: GameState): void {
  const p = state.player;
  const y = (state.yielding ??= { turn: state.turn, pending: [], accepted: [], refused: [] });
  const asked = new Set([...y.pending, ...y.accepted, ...y.refused]);
  const foes = yieldHearers(state).filter((a) => !asked.has(a.id));
  if (!foes.length) return logCode(state, 'invalid_yield', { actorId: p.id });
  for (const a of foes) (canAccept(a) ? y.pending : y.refused).push(a.id);
  y.turn = state.turn;
  logCode(state, 'player_yielded', { pending: y.pending, refused: y.refused });
}

/** MB41: a foe asked by the player's yield answers in its next output; no answer is a refusal */
export function answerYield(state: GameState, a: Actor, accept: boolean | undefined): void {
  const y = state.yielding;
  if (!y || !y.pending.includes(a.id) || y.turn >= state.turn) return; // answers come the turn after the yield
  y.pending = y.pending.filter((id) => id !== a.id);
  (accept ? y.accepted : y.refused).push(a.id);
  logCode(state, accept ? 'yield_accepted' : 'yield_refused', { actorId: a.id });
  if (!accept) return;
  // YD2: the taker's bandmates together with it honour the yield, unless they refused it to the player's face
  for (const m of state.actors) {
    if (m === a || !isActive(m) || !hostile(state, m, state.player) || y.accepted.includes(m.id) || y.refused.includes(m.id) || !together(state, a, m)) continue;
    y.pending = y.pending.filter((id) => id !== m.id);
    y.accepted.push(m.id);
    logCode(state, 'yield_accepted', { actorId: m.id, by: a.id });
  }
}

/** YD3: everyone who heard the yield has taken it */
export const yieldAllTaken = (state: GameState): boolean => { const y = state.yielding; return !!y && y.accepted.length > 0 && !y.pending.length && !y.refused.length; };

/** MB43: once yielded, the player cannot attack a foe that took the yield or has yet to answer it, and a foe that took it cannot attack the player */
export function yieldBars(state: GameState, a: Actor, t: Actor): boolean {
  const y = state.yielding;
  if (!y) return false;
  if (a === state.player) return y.accepted.includes(t.id) || y.pending.includes(t.id);
  return t === state.player && y.accepted.includes(a.id);
}
/** the player yielded and a foe took it: the fight is lost (MB42) */
export const yieldTaken = (state: GameState): boolean => !!state.yielding?.accepted.length;

// D-239: mercy once down. The player went down in a lethal fight: every active foe hostile to the player from a lethal band
// would finish them. A Claude-run foe of an Intelligent race that perceives the player (by any sense, as for a yield) is
// asked instead, and answers in its next output (spare); the rest finish. Sparing covers the sparer's bandmates together
// with it that were asked too (YD2). The player is spared only when someone spared and no one is left to finish.

/** the foes that would finish the downed player: active, hostile, from a lethal band (D-54) */
export const finishers = (state: GameState): Actor[] =>
  state.actors.filter((x) => isActive(x) && hostile(state, x, state.player) && bandById(state, x.bandId)?.lethal !== false);

/** D-239: the player just went down in a lethal fight; true while someone was asked whether to spare them */
export function askMercy(state: GameState): boolean {
  const pending: string[] = [], finish: string[] = [];
  for (const a of finishers(state)) (canAccept(a) && perceivesNow(state, a, state.player, 'normal') ? pending : finish).push(a.id);
  if (!pending.length) return false;
  state.mercy = { turn: state.turn, pending, spared: [], finish };
  logCode(state, 'mercy_asked', { pending, finish });
  return true;
}

/** D-239: a foe asked answers in its next output; no answer is finish */
export function answerMercy(state: GameState, a: Actor, spare: boolean | undefined): void {
  const m = state.mercy;
  if (!m || !m.pending.includes(a.id) || m.turn >= state.turn) return;
  m.pending = m.pending.filter((id) => id !== a.id);
  (spare ? m.spared : m.finish).push(a.id);
  logCode(state, spare ? 'mercy_spared' : 'mercy_finish', { actorId: a.id });
  if (!spare) return;
  for (const id of [...m.pending]) {
    const b = state.actors.find((x) => x.id === id);
    if (!b || !together(state, a, b)) continue;
    m.pending = m.pending.filter((x) => x !== id);
    m.spared.push(id);
    logCode(state, 'mercy_spared', { actorId: id, by: a.id });
  }
}

/** D-239: the turn after the player went down: spared (someone spared, nobody finishes) or not; clears the ask */
export function settleMercy(state: GameState): boolean {
  const m = state.mercy!;
  delete state.mercy;
  const left = new Set(finishers(state).map((x) => x.id)); // a finisher downed meanwhile no longer finishes
  return m.spared.length > 0 && !m.pending.length && !m.finish.some((id) => left.has(id));
}
