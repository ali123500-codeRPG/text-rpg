// OQ-29 Shaken and Swayed: a listener that lost a speech contest takes −(CONFIG.SHAKEN_PER_TIER or SWAYED_PER_TIER × the
// tier gap) on its rolls against the speaker until its engagement ends. Shaken (lost to intimidation) counts on every roll
// against the speaker, Swayed (lost to persuasion) only on speech rolls against them. Set by setPressure (engine/speech.ts).
import type { Actor, Mod } from '../types';
import { getLibrary } from '../library';
import { FN } from '../library/functionIds';

const isSpeechSkill = (skill: string): boolean => !!getLibrary().skills[skill]?.functions?.includes(FN.influence);

export function pressureMods(actor: Actor, against: string | undefined, skill: string): Mod[] {
  const p = against ? actor.pressure?.[against] : undefined;
  if (!p) return [];
  return [
    ...(p.shaken ? [{ source: 'Shaken', type: 'status' as const, value: -p.shaken }] : []),
    ...(p.swayed && isSpeechSkill(skill) ? [{ source: 'Swayed', type: 'status' as const, value: -p.swayed }] : []),
  ];
}
