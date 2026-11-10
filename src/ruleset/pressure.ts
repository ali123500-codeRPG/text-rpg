// OQ-29 Shaken and Swayed: a listener that lost a speech contest takes −(CONFIG.SHAKEN_PER_TIER or SWAYED_PER_TIER × the
// tier gap) on every roll against the speaker until its engagement ends (NT15: Swayed too, so a persuaded fighter can be
// talked into lowering the sword). Set by applySpeech (engine/speech.ts).
// NT3 Repeat try: each earlier try of the same speech kind at the same listener this engagement costs CONFIG.REPEAT_TRY.
import type { Actor, Mod } from '../types';
import { CONFIG } from '../config';

export function pressureMods(actor: Actor, against: string | undefined): Mod[] {
  const p = against ? actor.pressure?.[against] : undefined;
  if (!p) return [];
  return [
    ...(p.shaken ? [{ source: 'Shaken', type: 'status' as const, value: -p.shaken }] : []),
    ...(p.swayed ? [{ source: 'Swayed', type: 'status' as const, value: -p.swayed }] : []),
  ];
}

/** NT3: the speaker's penalty for trying `type` again at any of `listeners` this engagement (the most tries counts) */
export function repeatTryMods(speaker: Actor, listeners: string[], type: string): Mod[] {
  const n = Math.max(0, ...listeners.map((l) => speaker.speechTries?.[l]?.[type] ?? 0));
  return n ? [{ source: 'Repeat try', type: 'situational', value: -CONFIG.REPEAT_TRY * n }] : [];
}

/** NT3: count a try; plain talk never counts */
export function countTry(speaker: Actor, listener: string, type: string): void {
  if (type === 'talk') return;
  const t = ((speaker.speechTries ??= {})[listener] ??= {});
  t[type] = (t[type] ?? 0) + 1;
}
