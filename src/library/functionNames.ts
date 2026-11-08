// Skill groups and functions (Ali, 08/11/2026, F1–F8; docs/skill-tags.md). A skill lists one or more narrow functions:
// a missing skill borrows one sharing a function (stand-ins). Each function belongs to one broad group: a 40 perk's +1
// reaches every skill sharing a group with its ladder skill, and the XP category comes from the group. Code compares
// keys; text shows these names only. Adding a function or group is one row here.
import type { SkillDef, SkillFunction, SkillGroup } from '../types';

export const FUNCTION_GROUP: Record<SkillFunction, SkillGroup> = {
  arms: 'melee', unarmed: 'melee', ranged: 'ranged', defense: 'defense', health: 'health',
  sight: 'notice', hearing: 'notice', stealth: 'stealth', influence: 'influence',
};
export const GROUP_NAMES: Record<SkillGroup, string> = {
  melee: 'Melee', ranged: 'Ranged', defense: 'Defense', health: 'Health', notice: 'Notice', stealth: 'Stealth', influence: 'Influence',
};
/** the broad groups a skill belongs to, from its functions */
export const groupsOf = (s?: SkillDef): SkillGroup[] => [...new Set((s?.functions ?? []).map((f) => FUNCTION_GROUP[f]))];
