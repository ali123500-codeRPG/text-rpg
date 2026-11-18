// The skill cap on its own (no other ruleset imports), so library code such as NPC generation can read it without a cycle.
import type { SkillEntry } from '../types';
import { CONFIG } from '../config';

/** the cap in the improvement roll: SKILL_CAP, plus TAG_CAP_BONUS for a tagged skill (EG16), minus FLAW_CAP_PENALTY for a
 * flawed one. Not a hard limit (D-374 TB7): the roll's room runs out near it. NPC presets are still clamped to it (spawn). */
export const skillCap = (s: Pick<SkillEntry, 'state'>): number =>
  CONFIG.SKILL_CAP + (s.state === 'tagged' ? CONFIG.TAG_CAP_BONUS : 0) - (s.state === 'flawed' ? CONFIG.FLAW_CAP_PENALTY : 0);
