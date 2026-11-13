// The stamina bar (FT1–FT28): a long-term layer (sleep debt and spilled strain; only sleep clears it) and a thin short-term
// line (strain), both sized from Stamina as HP is from Endurance. The fatigue level is the share of the long term used
// (CONFIG.FATIGUE_TRACK); it sets the roll penalty and how much of the bar the short line holds. Paying and recovering:
// src/engine/fatigue.ts.
import type { Actor, GameState, Mod } from '../types';
import { CONFIG } from '../config';
import { SK } from '../library/skillIds';
import { itemDef } from '../library';
import { FATIGUE_LEVELS, type FatigueLevel } from '../scales';
import { skillOpen } from './access';

/** raw Stamina (like Endurance for HP); a closed or dormant skill counts 0 */
export function staminaSkill(a: Actor): number {
  const s = a.core.skills[SK.stamina];
  return s && !s.dormant && skillOpen(a, SK.stamina) ? s.raw : 0;
}
/** FT2: the bar's size (both layers) */
export const barMax = (a: Actor): number => CONFIG.STAMINA_BASE + CONFIG.STAMINA_PER_POINT * staminaSkill(a);
export const fatigueOf = (a: Actor): { debt: number; line: number } => a.core.condition.fatigue ?? { debt: 0, line: 0 };
/** share of the long-term bar used, in % */
export const debtPct = (a: Actor): number => (100 * fatigueOf(a).debt) / barMax(a);
const trackRow = (a: Actor) => { const pct = debtPct(a) + 1e-9; return [...CONFIG.FATIGUE_TRACK].reverse().find(([, from]) => pct >= from)!; };
export const fatigueLevel = (a: Actor): FatigueLevel => trackRow(a)[0];
/** FT19/FT22: the short line holds the level's band of the bar */
export const lineMax = (a: Actor): number => (barMax(a) * trackRow(a)[3]) / 100;
export const lineUsed = (a: Actor): number => Math.min(fatigueOf(a).line, lineMax(a));
/** FT10: Spent: the bar is full and the actor awake; no action above Light until it is below full */
export const isSpent = (a: Actor): boolean => fatigueLevel(a) === 'collapsed' && !a.asleep;
/** FT3: the level's roll penalty, type wounds, so it stacks with health and morale wounds */
export function fatigueMods(a: Actor): Mod[] {
  const [l, , v] = trackRow(a);
  return v ? [{ source: `fatigue: ${FATIGUE_LEVELS.name(l)}`, type: 'wounds', value: v }] : [];
}
/** FT17: others' fatigue shows from CONFIG.FATIGUE_SHOWN_FROM down */
export const fatigueShows = (l: FatigueLevel): boolean => FATIGUE_LEVELS.pos(l) >= FATIGUE_LEVELS.pos(CONFIG.FATIGUE_SHOWN_FROM);
/** the weight of the armour the actor wears, if any */
export function wornWeight(state: GameState | null, a: Actor): string | undefined {
  const worn = a.core.inventory.find((i) => i.equippedIn?.includes('armor'));
  return worn ? itemDef(state, worn.itemId).armor?.weight : undefined;
}
