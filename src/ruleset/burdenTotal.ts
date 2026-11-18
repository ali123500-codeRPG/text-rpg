// Burden's Total on its own (no other ruleset imports), so creation and NPC generation can read it without a cycle.
import type { SkillEntry } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { groupsOf } from '../library/functionNames';

/** D-374 TB1: the share of a skill's raw that counts toward the Total: 1, less TAG_BURDEN_SELF_PCT % for its own tag, less
 * TAG_BURDEN_GROUP_PCT % per tagged skill sharing a group with it (itself included). A lone tag lands on exactly 0; below 0
 * its raw lowers the Total. D-377 (FC4 a): plus FLAW_BURDEN_GROUP_PCT % per flawed skill sharing a group with it, itself included. */
export function burdenShare(id: string, tagged: string[], flawed: string[] = []): number {
  const skills = getLibrary().skills, groups = groupsOf(skills[id]);
  const mates = (list: string[]) => list.filter((k) => k === id || groupsOf(skills[k]).some((g) => groups.includes(g))).length;
  return (100 - (tagged.includes(id) ? CONFIG.TAG_BURDEN_SELF_PCT : 0) - mates(tagged) * CONFIG.TAG_BURDEN_GROUP_PCT + mates(flawed) * CONFIG.FLAW_BURDEN_GROUP_PCT) / 100;
}

/** Part 1 §6 Total: every skill's raw at its burdenShare */
export function burdenTotal(skills: Record<string, Pick<SkillEntry, 'raw' | 'state'>>): number {
  const of = (state: SkillEntry['state']) => Object.keys(skills).filter((k) => skills[k].state === state);
  const tagged = of('tagged'), flawed = of('flawed');
  return Object.entries(skills).reduce((n, [id, s]) => n + s.raw * burdenShare(id, tagged, flawed), 0);
}
