// Function and group IDs: like skills, skill functions and groups have fixed IDs, never their names, so a function and
// a group can share a display name (Defense, Ranged, Stealth, Influence) without sharing an ID. The type prefix (FN, GR)
// keeps them apart from each other and from skills (SK). Code refers to them
// through FN and GR; display names live only in FUNCTION_NAMES and GROUP_NAMES (functionNames.ts). Never renumber.
export const FN = {
  arms: 'FN1', unarmed: 'FN2', ranged: 'FN3', defense: 'FN4', armor: 'FN5', health: 'FN6',
  sight: 'FN7', hearing: 'FN8', stealth: 'FN9', influence: 'FN10', initiative: 'FN11', morale: 'FN12',
  engagement_aura: 'FN13', projected_aura: 'FN14', // NT14, MB27, MB39: auras, each with its own trigger
  lockpicking: 'FN15', // BA2: opening a lock without its key (Filching applied to a lock; D-89 RP20)
  filching: 'FN16', // FL1: taking what someone carries or owns without being caught (the Filching skill)
  stamina: 'FN17', // FT15: how long the body keeps going (the Stamina skill)
  smell: 'FN18', // AB18: noticing by smell (the Scent skill)
  healing: 'FN19', // NR33: mending someone else's body (the Healing skill)
  tactics: 'FN20', // TC14: reading and using a fight (Battle Sense, Fieldcraft, Stratagem stand in for each other)
  handiwork: 'FN21', // D-89: mending gear (the Handiwork skill)
  first_aid: 'FN22', // D-235 a: using a healing item (the First Aid skill)
} as const;
export const GR = {
  melee: 'GR1', ranged: 'GR2', defense: 'GR3', health: 'GR4', notice: 'GR5', stealth: 'GR6', influence: 'GR7', speed: 'GR8', will: 'GR9', aura: 'GR10', sleight: 'GR11', stamina: 'GR12', medicine: 'GR13', tactics: 'GR14', survival: 'GR15',
} as const;
/** compound ratings (GR10, GR36): rows that pool several skill groups into one rating (CONFIG.RATINGS). Prefix RT. */
export const RT = {
  melee_strength: 'RT1', ranged_strength: 'RT2', toughness: 'RT3', agility: 'RT4', presence: 'RT5', senses: 'RT6',
} as const;
export type RatingId = (typeof RT)[keyof typeof RT];
