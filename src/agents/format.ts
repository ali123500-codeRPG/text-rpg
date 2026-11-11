// Per-turn data (the second user turn) for each agent. Built only from the view handed in, never from GameState.
import { TACTICS } from '../scales';
import type { DialogueInput, DialogueView, NarrationView, OppositionView, PlayerView, WeaverView } from '../types';

const block = (name: string, v: unknown) => `${name}:\n${typeof v === 'string' ? v : JSON.stringify(v)}`;
const join = (...parts: string[]) => parts.join('\n\n');

export function formatPlayerView(text: string, view: PlayerView): string {
  return join(block('PLAYER_INPUT', text), block('PLAYER_VIEW', view));
}

/** CHARACTER: who the actor is (name, role, personality, band, band goals, temperament, tactics word), from its own view */
function character(view: OppositionView) {
  return { ...voiceCharacter(view), personality: view.personality, bandGoals: view.band.goals, temperament: view.band.temperament, tactics: TACTICS.name(view.band.tactics) };
}

/** the Voice is player-side: goals and temperament are the Weaver's hidden text, so only id, name, role and band name (Q1) */
function voiceCharacter(view: OppositionView | DialogueView) {
  return { id: view.self.id, name: view.self.name, role: view.self.label, band: view.band.name };
}

/** OppositionView minus the band block (it is in CHARACTER); fired triggers are shown as "already happened" */
function opposition(view: OppositionView) {
  const { band: _band, personality: _p, firedTriggers, ...rest } = view;
  return { ...rest, alreadyHappened: firedTriggers };
}

export function formatOppositionView(view: OppositionView): string {
  return join(block('CHARACTER', character(view)), block('OPPOSITION_VIEW', opposition(view)));
}

export function formatResponderInput(view: OppositionView, dialogue: DialogueInput, committed: string | null, slips: string[]): string {
  return join(
    block('CHARACTER', character(view)),
    block('OPPOSITION_VIEW', opposition(view)),
    block('DIALOGUE_INPUT', dialogue),
    block('COMMITTED', committed ?? 'none'),
    block('SLIPS', slips.length ? slips : 'none'),
  );
}

export function formatDialogueView(view: DialogueView): string {
  const { band: _band, personality: _p, knows, dialogue, ...rest } = view;
  return join(
    block('CHARACTER', voiceCharacter(view)),
    block('DIALOGUE_VIEW', rest),
    block('KNOWS', knows),
    block('PLAYER_SAID', dialogue.map((d) => d.spoken)),
    block('IMPRESSION', dialogue.map((d) => d.impression ?? 'none')),
  );
}

export function formatNarrationView(view: NarrationView): string {
  const { style, ...rest } = view;
  return join(block('STYLE', style), block('NARRATION_VIEW', rest));
}

/** catalogs first: they change only with libraryVersion, so they sit right after the fixed part (OQ-11) */
export function formatWeaverView(view: WeaverView): string {
  const { catalogs, ...rest } = view;
  return join(block('CATALOGS', catalogs), block('WEAVER_VIEW', rest));
}
