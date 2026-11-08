// Skill tree access (Ali, 08/11/2026, TA1–TA11). Each tree's library rule opens or closes it per actor; access is worked
// out from the library every time and never saved. A skill in a tree the actor can't access counts as 0 and can't be
// raised; its points are kept and come back with access (TA4 a). The same rules hold for the player and NPCs (TA9).
import type { AccessCond, Actor, TreeAccess } from '../types';
import { getLibrary } from '../library';

function holds(a: Actor, c: AccessCond): boolean {
  switch (c.kind) {
    case 'race': return a.core.raceId === c.id;
    case 'body': return a.core.bodyTypeId === c.id;
    case 'class': return a.core.classes.some((x) => x.classId === c.id && !x.dormant && x.state !== 'unlocked' && x.level >= (c.level ?? 1));
    case 'perk': return a.core.perks.some((p) => p.perkId === c.id && !p.dormant); // perks and quirks
  }
}

/** a condition as the player reads it: "Slime", "Swordsman 10", a race, class or perk name */
export function condName(c: AccessCond): string {
  const lib = getLibrary();
  const name = c.kind === 'race' ? lib.races?.[c.id]?.name : c.kind === 'class' ? lib.classes[c.id]?.name : c.kind === 'perk' ? lib.perks[c.id]?.name : undefined;
  const n = name ?? c.id.charAt(0).toUpperCase() + c.id.slice(1).replace(/_/g, ' ');
  return c.kind === 'class' && (c.level ?? 1) > 1 ? `${n} ${c.level}` : n;
}

/** why the actor can't use the tree, or '' when it can. A block always wins (TA2). */
export function treeBlock(a: Actor, treeId: string): string {
  const r: TreeAccess | undefined = getLibrary().trees[treeId]?.access;
  if (!r) return '';
  const block = r.blockedBy?.find((c) => holds(a, c));
  if (block) return `Blocked by: ${condName(block)}`;
  const miss = r.must?.find((c) => !holds(a, c));
  if (miss) return `Needs: ${condName(miss)}`;
  if (r.either?.length && !r.either.some((c) => holds(a, c))) return `Needs one of: ${r.either.map(condName).join(', ')}`;
  return '';
}

export const treeOpen = (a: Actor, treeId: string): boolean => !treeBlock(a, treeId);
/** a skill is usable when its tree is open to the actor */
export const skillOpen = (a: Actor, skill: string): boolean => treeOpen(a, getLibrary().skills[skill]?.treeId ?? '');
/** a class tree is a tree that needs a class */
export const classTree = (r?: TreeAccess): boolean => [...(r?.must ?? []), ...(r?.either ?? [])].some((c) => c.kind === 'class');
