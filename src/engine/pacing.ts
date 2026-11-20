// Pacing (P7): quiet turns counted, and a scenario with no beat left that stalls ends as worn out.
import { CONFIG } from '../config';
import type { GameEvent, GameState } from '../types';
import { logCode } from './effects';
import { actorById, isActive } from './relations';

/** how much the player knows: secrets, witnessed facts, names */
export function learned(state: GameState): number {
  const j = state.player.journal;
  return j ? j.secretsKnown.length + j.factsWitnessed.length + j.namesKnown.length : 0;
}

/**
 * A quiet turn: no attack, nothing new learned, no beat fired (the beat's own reset), never one in a fight (AT76). A stall (STALL_TURNS quiet turns
 * with no beat left) marks the scenario to end as worn out, and free roam starts (SD2 a). Rest, sleep and time skips
 * never end a scenario (SC4, SC9).
 */
export function updatePacing(state: GameState, events: GameEvent[], learnedBefore: number): void {
  const quiet = !events.some((e) => e.kind === 'attack') && learned(state) === learnedBefore;
  // AT76: a quiet turn in a fight (a standoff) is not the story stalling: it neither counts nor resets
  state.stage.quiet = !quiet ? 0 : (state.stage.quiet ?? 0) + (state.mode === 'tactical' ? 0 : 1);
  if (state.stage.breakCause || state.stage.roam || state.stage.between) return; // SD2 a: no stall in free roam, since no scenario runs; SW10 a: nor between Situations, where windows serve
  if (state.stage.quiet >= CONFIG.STALL_TURNS && !beatsLeft(state)) {
    state.stage.breakCause = 'story_beat';
    logCode(state, 'scenario_stalled', { number: state.stage.scenarioNumber, quiet: state.stage.quiet }); // SC12: code ended it, not the Weaver: a bug
  }
}

function beatsLeft(state: GameState): boolean {
  // a beat whose owner is down never fires, so it doesn't count
  return Object.entries(state.hidden.plans).some(([id, p]) => p.triggers.some((t) => t.when.type === 'quiet_turns' && isActive(actorById(state, t.ownerId ?? id)!)));
}
