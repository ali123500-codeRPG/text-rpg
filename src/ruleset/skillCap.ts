// The skill cap on its own (no other ruleset imports), so library code such as NPC generation can read it without a cycle.
import type { SkillEntry } from '../types';
import { CONFIG } from '../config';

/** the most raw training can reach: SKILL_CAP, plus TAG_CAP_BONUS for a tagged skill (EG16), minus FLAW_CAP_PENALTY for a
 * flawed one. A skill already above its cap keeps its raw and gains nothing. */
export const skillCap = (s: Pick<SkillEntry, 'state'>): number =>
  CONFIG.SKILL_CAP + (s.state === 'tagged' ? CONFIG.TAG_CAP_BONUS : 0) - (s.state === 'flawed' ? CONFIG.FLAW_CAP_PENALTY : 0);
