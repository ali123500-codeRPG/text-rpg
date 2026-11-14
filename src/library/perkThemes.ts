// CN1-CN2 (D-260): theme tags on perks. A payoff perk counts the owned perks with its tag (CN3) and grows a share per
// piece by the power rule (PAYOFF_SHARE × pieces^PAYOFF_EXP, RN4). A perk may carry any number of tags (CN1); one table keyed by theme, so
// moving a perk is one line. A payoff perk carries its own theme, so it counts itself as a piece.
import { PK } from './perkIds';

export type ThemeTag = 'ambush' | 'counter' | 'guard' | 'shout' | 'trick' | 'shadow';
/** what a payoff perk counts: owned perks with a theme tag, or quirks owned (PerkDef.quirk) */
export type PayoffCount = ThemeTag | 'quirk';

export const PERK_THEMES: Record<ThemeTag, string[]> = {
  ambush: [PK.hidden_strike, PK.strike_and_fade, PK.in_and_out, PK.opening_strike, PK.patient_knife],
  counter: [PK.counter, PK.answer_the_blow, PK.step_and_cut],
  guard: [PK.cover_ally, PK.shield_wall, PK.iron_rim, PK.blade_wall],
  shout: [PK.battle_cry, PK.dread_presence, PK.overwhelm, PK.crushing_presence, PK.chorus],
  trick: [PK.bluff, PK.dirt_in_the_eyes, PK.misdirection, PK.set_them_up, PK.make_them_stumble],
  shadow: [PK.melt_away, PK.hushed_steps, PK.child_of_night, PK.soft_tread, PK.quiet_mail],
};

/** a perk's theme tags */
export const themesOf = (perkId: string): ThemeTag[] => (Object.keys(PERK_THEMES) as ThemeTag[]).filter((t) => PERK_THEMES[t].includes(perkId));
