// Blessings (DX1; the system beyond the blessed start is parked as D-311). A blessing is a perk with PerkDef.blessing
// (its god and tier); a god's Blessed class (ClassDef.blessedBy) unlocks for whoever holds one of that god's blessings.
import type { Actor } from '../types';
import { getLibrary } from '../library';
import { createRng, textSeed } from '../rng';
import type { BlessingTierKey } from '../scales';

/** the gods who give a blessing of this tier, by ID */
export function blessingGods(tier: BlessingTierKey): string[] {
  return [...new Set(Object.values(getLibrary().perks).filter((p) => p.blessing?.tier === tier).map((p) => p.blessing!.god))].sort();
}

/** a god's Blessed class, if it has one */
export const blessedClass = (god: string): string | undefined => Object.values(getLibrary().classes).find((c) => c.blessedBy === god)?.id;

/** the blessed start's roll: a random god among those who give a blessing of the tier, then one of that god's blessings of
 * it; seeded by the story id, so a replay gives the same. Undefined when no god gives one */
export function rollBlessing(tier: BlessingTierKey, storyId: string): { god: string; perk: string } | undefined {
  const gods = blessingGods(tier);
  if (!gods.length) return undefined;
  const rng = createRng(textSeed(storyId));
  const god = gods[rng.int(0, gods.length - 1)];
  const perks = Object.values(getLibrary().perks).filter((p) => p.blessing?.god === god && p.blessing.tier === tier).map((p) => p.id).sort();
  return { god, perk: perks[rng.int(0, perks.length - 1)] };
}

/** does this character hold a blessing (not dormant) of this god */
export const blessedBy = (a: Actor, god: string): boolean =>
  a.core.perks.some((x) => !x.dormant && getLibrary().perks[x.perkId]?.blessing?.god === god);
