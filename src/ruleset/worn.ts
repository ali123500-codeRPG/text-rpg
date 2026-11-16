// IR19, IR24: several armor pieces can be worn when no body part is covered twice. Their weight costs (Dodge, noise,
// slowing, sleep) each count, stacked by the one stacking rule (MOD_STACK_EXP, as same-type roll modifiers are).
import type { Actor, GameState, ItemDef, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { wornArmors } from './slots';
import { powerStack } from './stacking';

export type WornPiece = { inst: ItemInstance; armor: NonNullable<ItemDef['armor']> };
/** the armor pieces an actor wears, with their armor rows */
export function wornPieces(state: GameState | null, a: Actor): WornPiece[] {
  return wornArmors(a.core.inventory).flatMap((inst) => { const armor = itemDef(state, inst.itemId).armor; return armor ? [{ inst, armor }] : []; });
}
/** the worn piece covering a body part, if any */
export const pieceOn = (state: GameState | null, a: Actor, part: string | null | undefined): WornPiece | undefined =>
  part ? wornPieces(state, a).find((p) => p.armor.covers.includes(part)) : undefined;
/** IR24 a: costs of one kind from several pieces, stacked (the largest in full) */
export const stackCost = (values: number[]): number => powerStack(values.filter((v) => v !== 0), CONFIG.MOD_STACK_EXP);
