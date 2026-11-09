// Equip requirements (EQ1–EQ13). An item's level asks for true skill (EQ1) in the skill that uses it, and
// stand-ins count at their usual share (EQ3). Falling short makes every roll with the item one outcome step worse per
// EQUIP_SHORT_STEP points short (EQ12 c); worn armor's shortfall reaches Dodge and stealth rolls.
import type { Actor, GameState, ItemDef, ItemInstance, RollKind, TierShift } from '../types';
import { CONFIG } from '../config';
import { EQUIP_LEVELS, type EquipLevelKey } from '../scales';
import { getLibrary, itemDef } from '../library';
import { trueSkill } from './perks';
import { achievementReqLower } from './achRewards';
import { modeSkill, standInShare, standInTable } from './gear';
import { SK, ARMOR_SKILL } from '../library/skillIds';

/** EQ11: a minted item of quality 3 or 4 is one level above its base, up to the top */
export function itemLevel(def: ItemDef): EquipLevelKey | undefined {
  if (!def.level) return undefined;
  return EQUIP_LEVELS.at(EQUIP_LEVELS.pos(def.level) + ((def.base?.quality ?? 0) >= 3 ? 1 : 0));
}

/** the skill an item asks for: a weapon's first mode, armor's weight (Light/Medium/Heavy Armor), a shield's Block */
export function requiredSkill(def: ItemDef): string | undefined {
  if (def.weapon?.modes[0]) return modeSkill(def.weapon.modes[0]);
  if (def.armor) return ARMOR_SKILL[def.armor.weight];
  if (def.shield) return SK.block;
  return undefined;
}

export function requirement(def: ItemDef): { skill: string; level: EquipLevelKey; need: number } | null {
  const level = itemLevel(def), skill = requiredSkill(def);
  return level && skill ? { skill, level, need: CONFIG.EQUIP_NEED[level] ?? 0 } : null;
}

/** true skill toward a requirement: the skill itself, or the best stand-in at its share */
export function skillToward(actor: Actor, skill: string): number {
  const table = standInTable(skill, actor);
  return Math.max(0, ...Object.keys(getLibrary().skills).map((id) => trueSkill(actor, id) * standInShare(skill, id, table)));
}

/** points short of an item's requirement (0 when met or when it has none) */
export function shortBy(actor: Actor, def: ItemDef): number {
  const r = requirement(def);
  return r ? Math.max(0, r.need - achievementReqLower(actor, r.skill) - skillToward(actor, r.skill)) : 0; // reqLower: only the check, never the item's numbers
}

/** EQ12 c: the tier shifts one roll takes for gear the roller falls short on */
export function shortShifts(state: GameState, actor: Actor, kind: RollKind | undefined, itemId: string | undefined): TierShift[] {
  const items: ItemInstance[] = actor.core.inventory.filter((i) =>
    (itemId && i.id === itemId) || ((kind === 'dodge' || kind === 'stealth') && i.equippedIn?.includes('armor')));
  const out: TierShift[] = [];
  for (const inst of items) {
    const def = itemDef(state, inst.itemId), short = shortBy(actor, def);
    if (short > 0) out.push({ source: `Short of ${def.name}'s requirement`, value: -Math.ceil(short / CONFIG.EQUIP_SHORT_STEP) });
  }
  return out;
}
