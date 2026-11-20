import type { NarrationScale, Past100Key } from './scales';
import { RULES } from './config/rules';
import { BODY } from './config/body';
import { PERCEPTION } from './config/perception';
import { MORALE } from './config/morale';
import { FATIGUE } from './config/fatigue';
import { CLOCK } from './config/clock';
import { ACTORS } from './config/actors';
import { GEAR } from './config/gear';
import { LAND } from './config/land';
import { WORLD } from './config/world';
import { PROGRESSION } from './config/progression';
import { ENGINE } from './config/engine';
import { PAST_100 } from './config/past100';
// Every tunable value. Spec "placeholder" values are config, not constants.
// Values marked Q2 are placeholders the spec names without a value (asked in the build plan, question 2).
// Read CONFIG at call time (tests may change a value and call resetConfig()).

/** a named step of the ladder past 100 (src/config/past100.ts; essence bounds may name one: min Bite 'divine' = 400) */
export const past100 = (k: Past100Key): number => PAST_100[k];

const DEFAULTS = {
  ...RULES,
  ...BODY,
  ...PERCEPTION,
  ...MORALE,
  ...FATIGUE,
  ...CLOCK,
  ...ACTORS,
  ...GEAR,
  ...LAND,
  ...WORLD,
  ...PROGRESSION,
  ...ENGINE,
};

export type Config = typeof DEFAULTS;
export const CONFIG: Config = structuredClone(DEFAULTS);
/** a new story's settings (difficulty is not a setting: it comes from who is there and the event roll, CS10) */
export const defaultSettings = (): { showMechanics: boolean; tone: string; narrationLength: NarrationScale } => ({ showMechanics: CONFIG.SHOW_ROLLS_DEFAULT, tone: CONFIG.STYLE.tone, narrationLength: 'normal' });
export function resetConfig(): void {
  Object.assign(CONFIG, structuredClone(DEFAULTS));
}

