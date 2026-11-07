// Library content shapes (Part 1 §3 skills, Part 3 creature database, Part 4 classes/templates, Part 5 items, routine bank).
import type { AttackMode, ItemDef } from './items';
import type { NpcTemplate } from './actor';
import type { ActivityDef, Routine, RoutineSet } from './hidden';
import type { EntryStatus } from './state';

export type SkillFunction = 'melee_attack' | 'ranged_attack' | 'unarmed_attack' | 'defense' | 'notice' | 'influence';
export type RoleId = 'sense' | 'grip' | 'move' | 'fly' | 'strike';
export type SizeId = 'tiny' | 'extra_small' | 'small' | 'normal' | 'big';
export type ImpactId = 'non_essential' | 'normal' | 'essential';

export type SkillDef = {
  id: string;
  treeId: string;
  functions: SkillFunction[];
  roles: RoleId[]; // body-part roles the skill uses (wounds reach a roll through these)
  playerOpen: boolean; // open to the player's point-buy
  cue?: 'sight' | 'sound'; // Notice skills: which cue they read
};
export type TreeDef = { id: string; name: string; skills: string[]; classId?: string };
export type ClassDef = { id: string; name: string; treeId: string; floors: Record<string, number> };

export type PartDef = { id: string; size: SizeId; impact: ImpactId; roles: RoleId[]; adjacent?: string[] };
export type NaturalArmor = { covers: string[]; reduction: number; multiplier: number; pools?: Record<string, number> };
export type CreatureType = {
  id: string;
  hpMultiplier: number;
  general: { name: string; size: SizeId };
  naturalAttacks: AttackMode[];
  naturalArmor?: NaturalArmor;
  parts: PartDef[];
  fallback: { attackSkill: string };
  /** optional body figure for the sheet: an SVG path per part id ('general' for the general area) */
  figure?: { viewBox: string; parts: Record<string, string> };
};

export type Library = {
  version: number;
  status: Record<string, EntryStatus>;
  skills: Record<string, SkillDef>;
  trees: Record<string, TreeDef>;
  classes: Record<string, ClassDef>;
  roles: Record<RoleId, { shared: boolean }>;
  creatures: Record<string, CreatureType>;
  items: Record<string, ItemDef>;
  templates: Record<string, NpcTemplate>;
  activities: Record<string, ActivityDef>;
  routines: Record<string, Routine>;
  routineSets: Record<string, RoutineSet>;
  perks: Record<string, { id: string; name: string; situation?: number }>;
};
