// What a roll does on average, taken over every d100 (no dice): the combat rating's equation and the non-combat shares
// read it. It calls the ruleset's own roll setup (rollSetup) and tier step (rollLevel), so dice and expectation share one
// set of rules. Like every balance model, tiers have no end (MODEL_TIER_REACH extra bands each way), whatever the roller
// has unlocked.
import type { Actor, AttackMode, GameState, RollRequest } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { rollMargin, sumShifts, rollLevel, rollSetup, type RollSetup } from '.';
import { actionRow, actionSeconds, attackRowIds } from './actionTime';

const ENDLESS = { up: CONFIG.MODEL_TIER_REACH, down: CONFIG.MODEL_TIER_REACH };

/** a set-up roll's odds hang on its margin before the die (skill and modifiers), its shifts, the skill (after-roll shifts)
 * and the roller's perks; the same ones are asked many times, so they are kept (cleared when the store fills) */
const oddsMemo = new Map<string, Map<number, number>>();
/** the chance of each tier level on a set-up roll, over d100 = 1..100 (after-roll shifts included, tiers endless) */
export function tierOdds(su: RollSetup): Map<number, number> {
  const key = `${rollMargin(0, su.eff.value, su.modifiers)}|${sumShifts(su.shifts)}|${su.eff.skill}|${su.actor.core.perks.map((p) => (p.dormant ? '' : p.perkId)).join(',')}`;
  const hit = oddsMemo.get(key);
  if (hit) return hit;
  const out = new Map<number, number>();
  for (let d = 1; d <= 100; d++) {
    const { level } = rollLevel(su, d, true, undefined, ENDLESS);
    out.set(level, (out.get(level) ?? 0) + 0.01);
  }
  if (oddsMemo.size > 20000) oddsMemo.clear();
  oddsMemo.set(key, out);
  return out;
}
/** the chance of each tier level on a roll as the request asks it (the actor's own modifiers added, as roll() does) */
export const rollOdds = (req: RollRequest, state: GameState, actor: Actor): Map<number, number> => tierOdds(rollSetup(req, state, actor));
/** E[f(tier level)] over a roll's odds */
export const expectOver = (odds: Map<number, number>, f: (level: number) => number): number => [...odds].reduce((n, [l, p]) => n + p * f(l), 0);

/** one attack mode an actor can use: the item instance id ('unarmed', 'natural:<mode>') and the mode */
export type ModeRef = { itemId: string; mode: AttackMode };

/** the seconds one attack with this mode takes (its Action times rows: a blow, a throw, a span and a shot) */
export function attackSecs(state: GameState, A: Actor, m: ModeRef): number {
  const inst = A.core.inventory.find((i) => i.id === m.itemId);
  return attackRowIds(inst ? itemDef(state, inst.itemId) : undefined, m.mode).reduce((n, id) => { const r = actionRow(id); return n + (r ? actionSeconds(r) : 0); }, 0);
}
