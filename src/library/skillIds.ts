// Skill IDs: every skill's ID is fixed (type prefix SK + a number), never its name, so renaming a skill touches only the
// names table (skillNames.ts). Code refers to skills through SK; data and saves store the ID.
// Never reuse or renumber an ID; a new skill takes the next free number.
import { FN } from './functionIds';

export const SK = {
  melee_light: 'SK1', melee_medium: 'SK2', melee_heavy: 'SK3',
  ranged_light: 'SK4', ranged_medium: 'SK5', ranged_heavy: 'SK6',
  unarmed_strike: 'SK7', unarmed_grapple: 'SK8', unarmed_improvised: 'SK9', unarmed_natural: 'SK10',
  dodge: 'SK11', block: 'SK12', endurance: 'SK13', eyesight: 'SK14', earshot: 'SK15',
  sneaking: 'SK16', combat_stealth: 'SK17', vanishing: 'SK18',
  persuasion: 'SK19', intimidation: 'SK20', barter: 'SK21', feint: 'SK22', riposte: 'SK23', disarm: 'SK24',
  light_armor: 'SK25', medium_armor: 'SK26', heavy_armor: 'SK27', tremor: 'SK28', lockpicking: 'SK29',
  lying: 'SK31', insight: 'SK32', // SK30 is taken by the Sword-dancer's Slip Counter
} as const;
export type SkillId = (typeof SK)[keyof typeof SK];
/** a standing defense (dodge or block, a choice, not a skill) and the skill it rolls */
export const DEFENSE_SKILL = { dodge: SK.dodge, block: SK.block } as const;
/** a sense function's default skill: a function roll asks for it, and the best skill with the function rolls */
export const SENSE_SKILL = { [FN.sight]: SK.eyesight, [FN.hearing]: SK.earshot } as const;
/** an armor weight and the skill that wears it */
export const ARMOR_SKILL: Record<string, SkillId> = { light: SK.light_armor, medium: SK.medium_armor, heavy: SK.heavy_armor };
/** a weapon tree and size class and the skill that wields it */
export const CLASS_SKILL: Record<string, Record<string, SkillId>> = {
  melee: { light: SK.melee_light, medium: SK.melee_medium, heavy: SK.melee_heavy },
  ranged: { light: SK.ranged_light, medium: SK.ranged_medium, heavy: SK.ranged_heavy },
};

/** a skill an agent wrote, as an ID: the ID itself, a display name or a code alias (e.g. "Eyesight" or "eyesight" → "14").
 * Anything else comes back unchanged, so legality still catches it. */
export function skillIdOf(x: string, names: Record<string, string>): string {
  if (Object.values(SK).includes(x as SkillId)) return x;
  const k = x.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const alias = (SK as Record<string, string>)[k] ?? (SK as Record<string, string>)[{ sight: 'eyesight', hearing: 'earshot' }[k] ?? ''];
  if (alias) return alias;
  const byName = Object.entries(names).find(([, n]) => n.toLowerCase() === x.trim().toLowerCase());
  return byName ? byName[0] : x;
}

/** the name-based skill IDs used before fixed IDs, so an older save's skills load under their IDs (library status) */
export const OLD_SKILL_IDS: Record<string, SkillId> = Object.fromEntries(
  Object.entries(SK).map(([k, id]) => [({ eyesight: 'sight', earshot: 'hearing' } as Record<string, string>)[k] ?? k, id]));
