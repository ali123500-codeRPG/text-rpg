// Skill tree access (TA1–TA11). Each tree's library rule opens or closes it per actor; access is worked
// out from the library every time and never saved. A skill in a tree the actor can't access counts as 0 and can't be
// raised; its points are kept and come back with access (TA4 a). The same rules hold for the player and NPCs (TA9).
import type { AccessCond, Actor, TreeAccess } from '../types';
import { getLibrary } from '../library';
import { essenceSkill, hasPerk, trueSkill } from './perks';
import { skillName } from '../library/skillNames';
import { PK } from '../library/perkIds';
import { cap } from '../words';

function holds(a: Actor, c: AccessCond): boolean {
  switch (c.kind) {
    case 'race': return a.core.raceId === c.id;
    case 'raceTag': return !!getLibrary().races?.[a.core.raceId ?? '']?.tags?.includes(c.id);
    case 'body': return a.core.bodyTypeId === c.id;
    case 'class': return a.core.classes.some((x) => x.classId === c.id && !x.dormant && x.state !== 'unlocked' && x.level >= (c.level ?? 1));
    case 'perk': return a.core.perks.some((p) => p.perkId === c.id && !p.dormant); // perks and quirks
    case 'skill': return trueSkill(a, c.id) >= (c.level ?? 0); // true skill at least level
    case 'classes': return a.core.classes.length >= (c.level ?? 0);
    case 'allStep': return new Set(a.core.perks.filter((p) => p.source === 'mastery' && (p.tier ?? 0) >= +c.id).map((p) => p.treeId)).size >= (c.level ?? 1);
    case 'skillsAbove': return Object.keys(a.core.skills).filter((s) => trueSkill(a, s) > +c.id).length >= (c.level ?? 1);
  }
}

/** a condition as the player reads it: "Slime", "Swordsman 10", a race, class or perk name */
export function condName(c: AccessCond): string {
  const lib = getLibrary();
  if (c.kind === 'skill') return `${skillName(c.id)} ${c.level ?? 0}`;
  if (c.kind === 'classes') return `${c.level ?? 0} classes`;
  if (c.kind === 'allStep') return `${c.level ?? 1} All-${c.id}`;
  if (c.kind === 'skillsAbove') return `${c.level ?? 1} skills above ${c.id}`;
  const name = c.kind === 'race' ? lib.races?.[c.id]?.name : c.kind === 'class' ? lib.classes[c.id]?.name : c.kind === 'perk' ? lib.perks[c.id]?.name : c.kind === 'body' ? lib.bodyTypes[c.id]?.name : undefined;
  const n = name ?? cap(c.id.replace(/_/g, ' '));
  return c.kind === 'class' && (c.level ?? 1) > 1 ? `${n} ${c.level}` : n;
}

/** why the actor fails the rule, or '' when it passes. A block always wins (TA2). */
function ruleBlock(a: Actor, r?: TreeAccess): string {
  if (!r) return '';
  const block = r.blockedBy?.find((c) => holds(a, c));
  if (block) return `Blocked by: ${condName(block)}`;
  const miss = r.must?.find((c) => !holds(a, c));
  if (miss) return `Needs: ${condName(miss)}`;
  if (r.either?.length && !r.either.some((c) => holds(a, c))) return `Needs one of: ${r.either.map(condName).join(', ')}`;
  return '';
}

/** whether the actor meets a rule (no rule: yes) */
export const ruleMet = (a: Actor, r?: TreeAccess): boolean => !ruleBlock(a, r);

/** why the actor can't use the tree, or '' when it can */
export const treeBlock = (a: Actor, treeId: string): string => (hasPerk(a, PK.no_road_closed) ? '' : ruleBlock(a, getLibrary().trees[treeId]?.access));
export const treeOpen = (a: Actor, treeId: string): boolean => !treeBlock(a, treeId);
/** why the actor can't use the skill: its tree's rule, then the skill's own */
export const skillBlock = (a: Actor, skill: string): string => {
  const s = getLibrary().skills[skill];
  // No Road Closed opens every tree and skill; so does a held essence that adds true skill to it, whatever the requirements,
  // and so does the actor's own natural attack (BG-250)
  return hasPerk(a, PK.no_road_closed) || essenceSkill(a, skill) > 0 ? '' : treeBlock(a, s?.treeId ?? '') || ruleBlock(a, s?.access);
};
export const skillOpen = (a: Actor, skill: string): boolean => !skillBlock(a, skill);
/** a class tree is a tree that needs a class */
export const classTree = (r?: TreeAccess): boolean => [...(r?.must ?? []), ...(r?.either ?? [])].some((c) => c.kind === 'class');
