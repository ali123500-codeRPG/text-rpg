// Breaking walls and barriers by strength (BW1, BW18-BW26; spec "Breaking walls and barriers"). A breaker's strength is
// the strength rating the action uses (strengthFor 'break': the best of Melee strength × 1 and Ranged strength × 0.5, read
// as it is, BW25 b). Strength is a lift in kg (liftKg: real anchors up to 100, then doubling every LIFT_DOUBLING_PER with
// no top, BW19 a); a breaking tool adds BREAK_TOOL_KG (BW22 a). A material's time at 50 (library barrierMaterials, BW24 a)
// grows with thickness and falls with the cube of the force (BW20 a). At WALK_THROUGH_S or less the wall does not count:
// it is walked through (BW21 a). No roll (BW23 a).
import type { Actor, Barrier, BarrierMaterial, GameState, Wall } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from '../library';
import { BREAK_TOOL_TAG } from '../library/itemIds';
import { PK } from '../library/perkIds';
import { hasPerk } from './perks';
import { strengthFor } from './ratings';
import { isHeld } from './slots';
import { usableModes } from './gear';

/** BW19 a: the lift (kg) at a strength: straight lines through CONFIG.LIFT_KG_AT, then doubling every LIFT_DOUBLING_PER */
export function liftKg(strength: number): number {
  const at = CONFIG.LIFT_KG_AT, s = Math.max(0, strength);
  const [lastS, lastKg] = at[at.length - 1];
  if (s >= lastS) return lastKg * 2 ** ((s - lastS) / CONFIG.LIFT_DOUBLING_PER);
  for (let i = 1; i < at.length; i++) {
    const [s0, k0] = at[i - 1], [s1, k1] = at[i];
    if (s <= s1) return k0 + ((k1 - k0) * (s - s0)) / (s1 - s0);
  }
  return lastKg;
}

/** a material row (barrierMaterials, BM) */
export const materialRow = (id: string | undefined): BarrierMaterial | undefined => (id ? getLibrary().barrierMaterials?.[id] : undefined);

/** what a thing to break is made of and how thick: its own material and thickness, else its kind's default material at
 * that material's example thickness (BW26 a: a wall's plan thickness is only how wide it is drawn) */
export type Stuff = { material: BarrierMaterial; cm: number };
export function wallStuff(w: Wall): Stuff | undefined {
  const own = materialRow(w.material);
  if (own) return { material: own, cm: w.thicknessM * 100 };
  const def = materialRow(getLibrary().wallKinds?.[w.kind]?.material);
  return def ? { material: def, cm: def.exampleCm } : undefined;
}
export function barrierStuff(b: Barrier): Stuff | undefined {
  const own = materialRow(b.material);
  if (own) return { material: own, cm: b.thicknessCm ?? own.exampleCm };
  const def = materialRow(getLibrary().barrierKinds?.[b.kind]?.material);
  return def ? { material: def, cm: b.thicknessCm ?? def.exampleCm } : undefined;
}

/** BW22 a: the breaking tool the actor would use: a carried sledgehammer or pick (best held first), else a heavy melee
 * weapon in hand with Shield Breaker; none: bare force */
export function breakTool(state: GameState, a: Actor): { itemId: string; perk?: true } | undefined {
  const tools = a.core.inventory.filter((i) => itemDef(state, i.itemId).tags?.includes(BREAK_TOOL_TAG));
  const t = tools.find(isHeld) ?? tools[0];
  if (t) return { itemId: t.id };
  if (!hasPerk(a, PK.shield_breaker)) return undefined;
  const heavy = usableModes(state, a).find((m) => m.mode.tree === 'melee' && m.mode.class === 'heavy' && !m.itemId.startsWith('natural:'));
  return heavy ? { itemId: heavy.itemId, perk: true } : undefined;
}

/** BW20 a: the force (kg) a breaker puts into a blow: the lift at their strength, plus a tool's */
export function breakForceKg(strength: number, tool: boolean): number {
  return liftKg(strength) + (tool ? CONFIG.BREAK_TOOL_KG : 0);
}

/** BW20 a, BW24 a: seconds to break a person-sized hole through `cm` of a material, at a strength, with or without a tool */
export function breakSecondsAt(material: BarrierMaterial, cm: number, strength: number, tool: boolean): number {
  const ref = breakForceKg(CONFIG.BREAK_REF_STRENGTH, true);
  const force = Math.max(1e-9, breakForceKg(strength, tool));
  return material.secondsAt50 * (cm / material.exampleCm) * (ref / force) ** CONFIG.BREAK_FORCE_POWER;
}

/** the actor's breaking strength (strengthFor 'break', BW18 and BW25 b) */
export const breakStrength = (state: GameState, a: Actor): number => strengthFor(state, a, 'break').value;

/** BW20: seconds this actor needs to break through `stuff`, with its best tool */
export function breakSeconds(state: GameState, a: Actor, stuff: Stuff): number {
  return breakSecondsAt(stuff.material, stuff.cm, breakStrength(state, a), !!breakTool(state, a));
}

/** BW21 a: the thing does not stop this actor: breaking it takes WALK_THROUGH_S or less */
export const walksThrough = (state: GameState, a: Actor, stuff: Stuff): boolean => breakSeconds(state, a, stuff) <= CONFIG.WALK_THROUGH_S;
