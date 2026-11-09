// Skill groups and functions (Ali, 08/11/2026, F1–F8; docs/skill-tags.md). A skill lists one or more narrow functions:
// a missing skill borrows one sharing a function (stand-ins). Each function belongs to one broad group: a 40 perk's +1
// reaches every skill sharing a group with its ladder skill, and the XP category comes from the group. Code compares
// keys; text shows these names only. Adding a function or group is one row here.
import type { SkillDef, SkillFunction, SkillGroup } from '../types';
import { FN, GR } from './functionIds';

export const FUNCTION_GROUP: Record<SkillFunction, SkillGroup> = {
  [FN.arms]: GR.melee, [FN.unarmed]: GR.melee, [FN.ranged]: GR.ranged, [FN.defense]: GR.defense, [FN.armor]: GR.defense, [FN.health]: GR.health,
  [FN.sight]: GR.notice, [FN.hearing]: GR.notice, [FN.stealth]: GR.stealth, [FN.influence]: GR.influence,
};
export const FUNCTION_NAMES: Record<SkillFunction, string> = {
  [FN.arms]: 'Arms', [FN.unarmed]: 'Unarmed', [FN.ranged]: 'Ranged', [FN.defense]: 'Defense', [FN.armor]: 'Armor', [FN.health]: 'Health',
  [FN.sight]: 'Sight', [FN.hearing]: 'Hearing', [FN.stealth]: 'Stealth', [FN.influence]: 'Influence',
};
export const GROUP_NAMES: Record<SkillGroup, string> = {
  [GR.melee]: 'Melee', [GR.ranged]: 'Ranged', [GR.defense]: 'Defense', [GR.health]: 'Health', [GR.notice]: 'Notice', [GR.stealth]: 'Stealth', [GR.influence]: 'Influence',
};
export const functionName = (id: string): string => (FUNCTION_NAMES as Record<string, string>)[id] ?? id;
export const groupName = (id: string): string => (GROUP_NAMES as Record<string, string>)[id] ?? id;
/** the broad groups a skill belongs to, from its functions */
export const groupsOf = (s?: SkillDef): SkillGroup[] => [...new Set((s?.functions ?? []).map((f) => FUNCTION_GROUP[f]))];
