// Function and group IDs: like skills, skill functions and groups have fixed IDs, never their names, so a function and
// a group can share a display name (Defense, Ranged, Stealth, Influence) without sharing an ID. The type prefix (FN, GR)
// keeps them apart from each other and from skills (SK). Code refers to them
// through FN and GR; display names live only in FUNCTION_NAMES and GROUP_NAMES (functionNames.ts). Never renumber.
export const FN = {
  arms: 'FN1', unarmed: 'FN2', ranged: 'FN3', defense: 'FN4', armor: 'FN5', health: 'FN6',
  sight: 'FN7', hearing: 'FN8', stealth: 'FN9', influence: 'FN10', initiative: 'FN11', morale: 'FN12',
  engagement_aura: 'FN13', offensive_aura: 'FN14', // NT14, MB27, MB39: auras, each with its own trigger
  lockpicking: 'FN15', // BA2: opening a lock without its key (the Lockpicking skill)
  filching: 'FN16', // FL1: taking what someone carries or owns without being caught (the Filching skill)
} as const;
export const GR = {
  melee: 'GR1', ranged: 'GR2', defense: 'GR3', health: 'GR4', notice: 'GR5', stealth: 'GR6', influence: 'GR7', speed: 'GR8', will: 'GR9', aura: 'GR10', sleight: 'GR11',
} as const;
