// BK1-BK4: what forcing a container open does to what is inside. Every item has a fragility (FRAGILITY, ItemDef.fragility,
// else CONFIG.FRAGILITY_BY_KIND for its kind); each fragility breaks at a break roll of CONFIG.FRAGILITY_BREAKS_AT or worse.
// One break roll checks everything inside (BK2): every item the roll's tier reaches breaks, a whole stack together. The
// breaker's safeBreak achievement reward moves every line that many tiers worse (BK4). A broken item stays as its broken
// version (BK3): the same item tagged 'broken', named "broken <name>", worth CONFIG.BROKEN_VALUE_SHARE of its value, and
// doing nothing (no attack, armor, healing or bonus).
import type { Actor, GameState, ItemDef, ItemInstance, TierRoll } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { tierLevel } from '../ruleset';
import { itemValue } from '../ruleset/value';
import { bestReward } from '../ruleset/achRewards';
import type { FragilityKey } from '../scales';

export const BROKEN_TAG = 'broken';

/** BK1: an item's fragility: its own, unbreakable for a Threadbound item, else its kind's */
export const fragilityOf = (def: ItemDef): FragilityKey => def.fragility ?? (def.threadbound ? 'unbreakable' : CONFIG.FRAGILITY_BY_KIND[def.kind] ?? 'sturdy');

/** BK1/BK4: the tier level at or below which a break roll breaks the item, its line moved `safer` tiers worse; null: never */
export function breakLine(def: ItemDef, safer = 0): number | null {
  const at = CONFIG.FRAGILITY_BREAKS_AT[fragilityOf(def)];
  return at ? tierLevel(at) - safer : null;
}

/** does this break roll break the item (already broken, soulbound or unbreakable: never) */
export function breaks(state: GameState, inst: ItemInstance, roll: TierRoll, safer = 0): boolean {
  const def = itemDef(state, inst.itemId);
  if (inst.soulbound || def.tags?.includes(BROKEN_TAG)) return false;
  const line = breakLine(def, safer);
  return line !== null && tierLevel(roll) <= line;
}

/** BK3: the broken version of an item, made once per item and kept with the story's blueprints */
export function brokenVersion(state: GameState, itemId: string): string {
  const id = `${itemId}_broken`;
  if (state.blueprints.some((b) => b.kind === 'item' && b.id === id)) return id;
  const whole = itemDef(state, itemId);
  const def: ItemDef = {
    ...structuredClone(whole), id, name: `broken ${whole.name}`, tags: [...(whole.tags ?? []).filter((t) => t !== 'kit'), BROKEN_TAG],
    value: Math.round(itemValue(state, whole) * CONFIG.BROKEN_VALUE_SHARE),
  };
  for (const k of ['weapon', 'armor', 'shield', 'heal', 'effects', 'consumable', 'boon', 'base', 'threadbound', 'slot', 'level', 'gearClass', 'shotTime', 'spanTime', 'edge'] as const) delete def[k];
  state.blueprints.push({ storyId: state.storyId, id, kind: 'item', data: def as unknown as Record<string, unknown> });
  return id;
}

/** BK2/BK4: one break roll by `a` checked against everything in `inside`: what it reaches turns into its broken version.
 * Returns the instances that broke. */
export function breakInside(state: GameState, a: Actor, inside: ItemInstance[], roll: TierRoll): ItemInstance[] {
  const safer = bestReward(a, 'safeBreak')?.value ?? 0;
  const hit = inside.filter((i) => breaks(state, i, roll, safer));
  for (const i of hit) i.itemId = brokenVersion(state, i.itemId);
  return hit;
}
