// Skill groups and functions (F1–F8; docs/skill-tags.md). A skill lists one or more narrow functions:
// a missing skill borrows one sharing a function (stand-ins). Each function belongs to one broad group: a 40 perk's +1
// reaches every skill sharing a group with its ladder skill, and the XP category comes from the group. Code compares
// keys; text shows these names only. Adding a function or group is one row here.
import type { SkillDef, SkillFunction, SkillGroup } from '../types';
import { FN, GR } from './functionIds';

export const FUNCTION_GROUP: Record<SkillFunction, SkillGroup> = {
  [FN.arms]: GR.melee, [FN.unarmed]: GR.melee, [FN.ranged]: GR.ranged, [FN.defense]: GR.defense, [FN.armor]: GR.defense, [FN.health]: GR.health,
  [FN.sight]: GR.notice, [FN.hearing]: GR.notice, [FN.stealth]: GR.stealth, [FN.influence]: GR.influence,
  [FN.initiative]: GR.speed, [FN.morale]: GR.will, [FN.engagement_aura]: GR.aura, [FN.offensive_aura]: GR.aura,
  [FN.lockpicking]: GR.sleight, [FN.filching]: GR.sleight, // FL1: the Sleight group, clever fingers on locks and purses
  [FN.stamina]: GR.stamina, // FT15: its own group, at quarter XP
};
export const FUNCTION_NAMES: Record<SkillFunction, string> = {
  [FN.arms]: 'Arms', [FN.unarmed]: 'Unarmed', [FN.ranged]: 'Ranged', [FN.defense]: 'Defense', [FN.armor]: 'Armor', [FN.health]: 'Health',
  [FN.sight]: 'Sight', [FN.hearing]: 'Hearing', [FN.stealth]: 'Stealth', [FN.influence]: 'Influence', [FN.initiative]: 'Initiative', [FN.morale]: 'Morale',
  [FN.engagement_aura]: 'Engagement aura', [FN.offensive_aura]: 'Offensive aura', [FN.lockpicking]: 'Lockpicking', [FN.filching]: 'Filching', [FN.stamina]: 'Stamina',
};
export const GROUP_NAMES: Record<SkillGroup, string> = {
  [GR.melee]: 'Melee', [GR.ranged]: 'Ranged', [GR.defense]: 'Defense', [GR.health]: 'Health', [GR.notice]: 'Notice', [GR.stealth]: 'Stealth', [GR.influence]: 'Influence', [GR.speed]: 'Speed', [GR.will]: 'Will', [GR.aura]: 'Aura', [GR.sleight]: 'Sleight', [GR.stamina]: 'Stamina',
};
export const functionName = (id: string): string => (FUNCTION_NAMES as Record<string, string>)[id] ?? id;
export const groupName = (id: string): string => (GROUP_NAMES as Record<string, string>)[id] ?? id;
/** functions that are rolled as a function: the roll counts every skill with it at full value and the best one
 * rolls (fnRoller, RollRequest.fn), so a sight or hearing roll never uses the stand-in share */
export const FUNCTION_ROLLS: SkillFunction[] = [FN.sight, FN.hearing, FN.lockpicking, FN.filching];
/** the broad groups a skill belongs to: from its functions, plus any it joins directly (SkillDef.groups) */
export const groupsOf = (s?: SkillDef): SkillGroup[] => [...new Set([...(s?.functions ?? []).map((f) => FUNCTION_GROUP[f]), ...(s?.groups ?? [])])];
