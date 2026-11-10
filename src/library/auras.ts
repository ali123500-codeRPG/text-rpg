// Auras (NT14, MB19, MB36–MB39): every aura in the game, keyed by the perk that gives it. A new aura is one row.
// engine/auras.ts runs them; the skills they roll are the aura skills (Crushing Presence adds to them).
import { FN } from './functionIds';
import { PK } from './perkIds';
import { SK } from './skillIds';
import { FR } from './tableIds';

export type AuraDef = { perk: string; fn: string; skill: string; fear: string; shaken?: true };
export const AURAS: AuraDef[] = [
  { perk: PK.dread_presence, fn: FN.engagement_aura, skill: SK.intimidation, fear: FR.dread_presence, shaken: true },
  { perk: PK.battle_cry, fn: FN.offensive_aura, skill: SK.intimidation, fear: FR.battle_cry }, // triggered by its move (battleCry)
];
/** the aura skills: every skill an aura in the game rolls */
export const AURA_SKILLS: string[] = [...new Set(AURAS.map((a) => a.skill))];
