// Function and group IDs: like skills, skill functions and groups have fixed numeric IDs, never their
// names, so a function and a group can share a display name (Defense, Ranged, Stealth, Influence) without sharing an ID.
// Functions are numbered from 101 and groups from 201, so no ID is shared with a skill (1–99) either. Code refers to them
// through FN and GR; display names live only in FUNCTION_NAMES and GROUP_NAMES (functionNames.ts). Never renumber.
export const FN = {
  arms: '101', unarmed: '102', ranged: '103', defense: '104', armor: '105', health: '106',
  sight: '107', hearing: '108', stealth: '109', influence: '110',
} as const;
export const GR = {
  melee: '201', ranged: '202', defense: '203', health: '204', notice: '205', stealth: '206', influence: '207',
} as const;
