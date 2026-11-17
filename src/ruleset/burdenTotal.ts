// Burden's Total on its own (no other ruleset imports), so creation and NPC generation can read it without a cycle.
import type { SkillEntry } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { groupsOf } from '../library/functionNames';

/** D-374 TB1: the share of a skill's raw that counts toward the Total: 1, less TAG_BURDEN_SELF_PCT % for its own tag, less
 * TAG_BURDEN_GROUP_PCT % per tagged skill sharing a group with it (itself included). A lone tag lands on exactly 0; below 0
 * its raw lowers the Total. */
export function burdenShare(id: string, tagged: string[]): number {
  const skills = getLibrary().skills, groups = groupsOf(skills[id]);
  const tags = tagged.filter((k) => k === id || groupsOf(skills[k]).some((g) => groups.includes(g))).length;
  return (100 - (tagged.includes(id) ? CONFIG.TAG_BURDEN_SELF_PCT : 0) - tags * CONFIG.TAG_BURDEN_GROUP_PCT) / 100;
}

/** Part 1 §6 Total: every skill's raw at its burdenShare (flawed skills count in full) */
export function burdenTotal(skills: Record<string, Pick<SkillEntry, 'raw' | 'state'>>): number {
  const tagged = Object.keys(skills).filter((k) => skills[k].state === 'tagged');
  return Object.entries(skills).reduce((n, [id, s]) => n + s.raw * burdenShare(id, tagged), 0);
}
