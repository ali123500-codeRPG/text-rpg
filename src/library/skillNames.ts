import { SK } from './skillIds';
// Skill display names: the one names table (coding rule). Code and saves use the ids; text reads names from here.
// Sight → Eyesight, Hearing → Earshot.
export const SKILL_NAMES: Record<string, string> = {
  [SK.melee_light]: 'Light weapons', [SK.melee_medium]: 'Medium weapons', [SK.melee_heavy]: 'Heavy weapons',
  [SK.ranged_light]: 'Light ranged', [SK.ranged_medium]: 'Medium ranged', [SK.ranged_heavy]: 'Heavy ranged',
  [SK.unarmed_strike]: 'Strike', [SK.unarmed_grapple]: 'Grapple', [SK.unarmed_improvised]: 'Improvisation', [SK.slam]: 'Slam',
  [SK.dodge]: 'Dodge', [SK.block]: 'Block', [SK.endurance]: 'Endurance', [SK.eyesight]: 'Eyesight', [SK.earshot]: 'Earshot', [SK.sneaking]: 'Sneaking', [SK.combat_stealth]: 'Combat Stealth', [SK.vanishing]: 'Vanishing',
  [SK.persuasion]: 'Persuasion', [SK.intimidation]: 'Intimidation', [SK.barter]: 'Barter', [SK.riposte]: 'Riposte', [SK.parry]: 'Parry', [SK.blade_dance]: 'Blade Dance', [SK.shrewd_dealing]: 'Shrewd Dealing',
  [SK.light_armor]: 'Light Armor', [SK.medium_armor]: 'Medium Armor', [SK.heavy_armor]: 'Heavy Armor',
  [SK.tremor]: 'Tremor', [SK.lockpicking]: 'Lockpicking', [SK.filching]: 'Filching', [SK.lying]: 'Lying', [SK.insight]: 'Insight', [SK.resolve]: 'Resolve', [SK.stamina]: 'Stamina',
  [SK.bite]: 'Bite', [SK.claws]: 'Claws', [SK.hooves_horns]: 'Hooves and Horns', [SK.tail]: 'Tail', [SK.scent]: 'Scent', [SK.hide]: 'Hide',
};
export const skillName = (id: string) => SKILL_NAMES[id] ?? id;
