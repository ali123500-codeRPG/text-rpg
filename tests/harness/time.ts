// AT15: timers count game time from turn stamps. Tests that step turns by hand move the clock with them.
import { CONFIG } from '../../src/config';
import { advanceClock, noteTurnEnd } from '../../src/time';
import type { GameState } from '../../src/types';

/** end the current turn now and start the next one `seconds` of game time later (default: one fight turn) */
export function tick(s: GameState, seconds: number = CONFIG.FIGHT_TURN_S): void {
  noteTurnEnd(s);
  s.turn += 1;
  advanceClock(s, seconds / 60);
}
/** how many turns of `turnS` seconds it takes for `seconds` to pass */
export const turnsFor = (seconds: number, turnS: number = CONFIG.FIGHT_TURN_S): number => Math.ceil(seconds / turnS);
/** say turn `t` ended `seconds` of game time before now */
export function ago(s: GameState, t: number, seconds: number): void {
  (s.turnEnds ??= {})[t] = (s.clocks.time ?? CONFIG.TIME_OF_DAY_FROM.morning) - seconds / 60;
}
