// D-200 (D-200b b): attention. What lies off the way someone faces, or what it sees while busy, is seen worse. Each step
// is one rung down one ladder: clear, then a glimpse that is minor, moderate, major, extreme to make out. Nothing is lost
// to attention alone: a glimpse stops at extreme. Facing is the way the body last walked or turned (engine/position.ts);
// someone that has never walked or turned has no facing yet, and sees all round it.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { busyNow } from '../engine/busy';
import type { Located } from '../engine/position';

/** degrees between where `observer` faces and the point `at` (0 straight ahead, 180 straight behind); null with no facing */
export function offFacingDeg(observer: { pos?: { x: number; y: number }; facing?: [number, number] }, at: { x: number; y: number } | undefined): number | null {
  const f = observer.facing, p = observer.pos;
  if (!f || !p || !at) return null;
  const dx = at.x - p.x, dy = at.y - p.y, d = Math.hypot(dx, dy), fl = Math.hypot(f[0], f[1]);
  if (d <= 1e-6 || fl <= 1e-6) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (dx * f[0] + dy * f[1]) / (d * fl)))) * 180) / Math.PI;
}

/** D-200: `observer` is fighting someone other than the one at `at`: it struck at someone this turn or last, and not at them */
function fightingElse(state: GameState, observer: Actor, at: Located): boolean {
  const id = 'core' in at ? (at as Actor).id : undefined;
  const struck = state.events.filter((e) => e.actorId === observer.id && e.kind === 'attack' && !!e.target && e.turn >= state.turn - 1).map((e) => e.target!);
  return struck.length > 0 && (id === undefined || !struck.includes(id));
}

/** D-200: how many rungs worse `observer` sees what is at `at`: ATTENTION_SIDE_STEPS past ATTENTION_SIDE_DEG off its facing,
 * ATTENTION_BACK_STEPS past ATTENTION_BACK_DEG, and ATTENTION_BUSY_STEPS more while busy (a long action under way, or
 * fighting someone else) */
export function attentionSteps(state: GameState, observer: Actor, at: Located): number {
  const deg = offFacingDeg(observer, at.pos);
  const off = deg === null ? 0 : deg > CONFIG.ATTENTION_BACK_DEG ? CONFIG.ATTENTION_BACK_STEPS : deg > CONFIG.ATTENTION_SIDE_DEG ? CONFIG.ATTENTION_SIDE_STEPS : 0;
  const busy = busyNow(observer) || fightingElse(state, observer, at) ? CONFIG.ATTENTION_BUSY_STEPS : 0;
  return off + busy;
}

/** D-200: a sight level after `steps` rungs of attention: clear becomes a glimpse; a glimpse stays one (its grade is harder, faintness) */
export const attended = (level: 'full' | 'partial' | null, steps: number): 'full' | 'partial' | null => (level === 'full' && steps > 0 ? 'partial' : level);
