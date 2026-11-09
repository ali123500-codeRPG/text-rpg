// Skill IDs (Ali, 09/11/2026): every skill's ID is a fixed number, never its name, so renaming a skill touches only the
// names table (skillNames.ts). Code refers to skills through SK; data and saves store the number (as a string key).
// Never reuse or renumber an ID; a new skill takes the next free number.
export const SK = {
  melee_light: '1', melee_medium: '2', melee_heavy: '3',
  ranged_light: '4', ranged_medium: '5', ranged_heavy: '6',
  unarmed_strike: '7', unarmed_grapple: '8', unarmed_improvised: '9', unarmed_natural: '10',
  dodge: '11', block: '12', endurance: '13', eyesight: '14', earshot: '15',
  sneaking: '16', combat_stealth: '17', vanishing: '18',
  persuasion: '19', intimidation: '20', barter: '21', feint: '22', riposte: '23', disarm: '24',
  light_armor: '25', medium_armor: '26', heavy_armor: '27', tremor: '28', lockpicking: '29',
} as const;
export type SkillId = (typeof SK)[keyof typeof SK];
/** a standing defense (dodge or block, a choice, not a skill) and the skill it rolls */
export const DEFENSE_SKILL = { dodge: SK.dodge, block: SK.block } as const;
/** a sense function's default skill: a function roll asks for it, and the best skill with the function rolls */
export const SENSE_SKILL = { sight: SK.eyesight, hearing: SK.earshot } as const;
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
