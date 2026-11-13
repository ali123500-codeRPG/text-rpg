// The Action times table (AT1, AT11, AT12, D-248): how long an action takes. One equation for every row: the row's seconds
// × the actor's time factor, sped by the row's speed function when it names one.
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import type { DurationDef } from '../types';

/** AT22: an actor's time factor; 1 for everyone until the speed skills exist (D-248) */
export const timeFactor = (): number => 1;

/** an Action times row by its DU id */
export const actionRow = (id: string): DurationDef | undefined => getLibrary().durations?.[id];

/** AT11/D-248: a row's seconds at time factor `factor`. A row naming a speed function takes the effective skill of that
 * function (`skill`; 50 when not given): halved every `halving` points above 50 (no faster past `fastCap`), doubled every
 * `halving` below */
export function actionSeconds(row: DurationDef, skill = 50, factor = timeFactor()): number {
  const sp = row.speed;
  const eff = sp?.fastCap == null ? skill : Math.min(skill, sp.fastCap);
  return row.seconds * factor * (sp ? 2 ** ((50 - eff) / sp.halving) : 1);
}

/** AT72: an engagement ends after the slowest attack cycle in the table (a reload and the shot it readies, or one attack)
 * plus one round to react, so a crossbowman spanning between shots never drops out of the fight */
export function engagementEndS(): number {
  const rows = getLibrary().durations ?? {};
  const cycle = (r: DurationDef) => r.seconds + (r.readies ? rows[r.readies]?.seconds ?? 0 : 0);
  return Math.max(0, ...Object.values(rows).filter((r) => r.attack || r.readies).map(cycle)) + CONFIG.ROUND_S;
}
