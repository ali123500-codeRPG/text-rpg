// Equip requirements (EQ1–EQ13). An item's level asks for true skill (EQ1) in the skill that uses it, and
// stand-ins count at their usual share (EQ3). Falling short makes every roll with the item one outcome step worse per
// EQUIP_SHORT_STEP points short (EQ12 c); worn armor's shortfall reaches Dodge and stealth rolls.
import type { Actor, GameState, ItemDef, ItemInstance, RollKind, TierShift } from '../types';
import { CONFIG } from '../config';
import { EQUIP_LEVELS, QUALITY_LEVELS, type EquipLevelKey } from '../scales';
import { getLibrary, itemDef } from '../library';
import { trueSkill } from './perks';
import { achievementReqLower } from './achRewards';
import { standInShare, standInTable } from './gear';

/** EQ11: a minted item of QUALITY_LEVEL_UP_FROM or better is one level above its base, up to the top */
export function itemLevel(def: ItemDef): EquipLevelKey | undefined {
  if (!def.level) return undefined;
  return EQUIP_LEVELS.at(EQUIP_LEVELS.pos(def.level) + (def.base && QUALITY_LEVELS.pos(def.base.quality) >= QUALITY_LEVELS.pos(CONFIG.QUALITY_LEVEL_UP_FROM) ? 1 : 0));
}

/** the skill an item asks for: its gear class's (the class sets the type, the level the amount) */
export function requiredSkill(def: ItemDef): string | undefined {
  return def.gearClass ? getLibrary().gearClasses?.[def.gearClass]?.skill : undefined;
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
