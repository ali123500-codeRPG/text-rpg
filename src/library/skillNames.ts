// Skill display names: the one names table (coding rule). Code and saves use the ids; text reads names from here.
// Sight → Eyesight, Hearing → Earshot.
export const SKILL_NAMES: Record<string, string> = {
  melee_light: 'Light weapons', melee_medium: 'Medium weapons', melee_heavy: 'Heavy weapons',
  ranged_light: 'Light ranged', ranged_medium: 'Medium ranged', ranged_heavy: 'Heavy ranged',
  unarmed_strike: 'Strike', unarmed_grapple: 'Grapple', unarmed_improvised: 'Improvisation', unarmed_natural: 'Natural weapons',
  dodge: 'Dodge', block: 'Block', endurance: 'Endurance', sight: 'Eyesight', hearing: 'Earshot', sneaking: 'Sneaking', combat_stealth: 'Combat Stealth', vanishing: 'Vanishing',
  persuasion: 'Persuasion', intimidation: 'Intimidation', barter: 'Barter', feint: 'Feint', riposte: 'Riposte', disarm: 'Disarm',
  light_armor: 'Light Armor', medium_armor: 'Medium Armor', heavy_armor: 'Heavy Armor',
  tremor: 'Tremor', lockpicking: 'Lockpicking',
};
export const skillName = (id: string) => SKILL_NAMES[id] ?? id;
