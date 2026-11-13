// FT9 helpers for sleep tests; kept out of the harness index so unit tests that mock the rules don't load the engine early
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';
import { barMax } from '../../src/ruleset/fatigue';
import { sleepMult } from '../../src/engine/fatigue';

/** FT9: give the player the sleep debt `hours` of sleep where they stand clears, so a sleep runs that long */
export function sleepDebtFor(s: GameState, hours: number): void {
  const per = (CONFIG.SLEEP_CLEAR_PCT / 100) * barMax(s.player) * sleepMult(s, s.player);
  s.player.core.condition.fatigue = { debt: hours * per, line: 0 };
}
