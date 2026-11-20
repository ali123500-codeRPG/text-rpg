// CONFIG defaults: the morale bar. src/config.ts spreads every part into one DEFAULTS in file order,
// so a key keeps its place: moving keys between parts, or reordering them, changes CONFIG's key order.
import type { MoraleLevel } from '../scales';

export const MORALE = {
  // ---- morale bar (MB1–MB43; placeholders) ----
  /** max morale = MORALE_BASE + MORALE_PER_RESOLVE × Resolve (MB29), like HP from Endurance */
  MORALE_BASE: 50,
  MORALE_PER_RESOLVE: 1,
  /** PL3, PL20: raw Resolve where each Nerve tier starts (one per NERVE_LINES row); 100 and up is superhuman */
  NERVE_TIER_FROM: [0, 20, 40, 60, 80, 100],
  /** PL20: past the last tier, every this much more Resolve adds a + to its name */
  NERVE_BEYOND_STEP: 50,
  /** PL2, PL3: a Nerve or trait value leans (counts) at this distance from 0 or more */
  PERSONALITY_LEAN: 20,
  /** the action deck: a held value pulls toward its actions by this many points, as a trait would */
  IDEA_VALUE_PULL: 50,
  /** the action deck: an action the character is pulled away from by this many points or more gets the against-your-nature mark */
  IDEA_AGAINST_NATURE: 50,
  /** AD9 the suggested action: base score of each kind of suggestion (higher wins); leanShare: points per point of the
   * character's pull toward it; healInFight: taken off treating wounds while a fight runs. [placeholder] */
  SUGGEST: { broken: 100, offer: 90, heldOut: 80, steady: 55, heal: 50, healInFight: 15, attack: 60, inReach: 10, finish: 65, walking: 45, loot: 40, newGround: 30, quest: 35, look: 10, leanShare: 0.1 },
  /** AD9: the morale level from which steadying is suggested in a fight, and the health level from which treating wounds is */
  SUGGEST_STEADY_FROM: 'rattled' as import('../scales').MoraleLevel,
  GRIT_AUTO_FROM: 'rattled' as import('../scales').MoraleLevel, // LG7 Grit Your Teeth: the owner steadies itself at once, once a fight, at this morale level or worse
  SUGGEST_HEAL_FROM: 'hurt' as import('../scales').HealthLevelKey,
  /** PL9: the word before a trait, from its distance from 0: [from, word] (below the first, the trait is left out) */
  TRAIT_WORDS: [[20, 'a bit '], [40, ''], [70, 'very ']] as [number, string][],
  /** archetype gap: the six axes and Nerve count 1 each, the drive fit counts this many times */
  ARCHETYPE_VALUE_WEIGHT: 2,
  /** drive fit for a type with no values (Ordinary): the same as a type none of whose values they hold */
  ARCHETYPE_NO_VALUES_GAP: 100,
  /** how much a held value counts toward a type's drive fit by its rank (first 1, second 0.8...); past the list, the last */
  DRIVE_RANK_WEIGHT: [1, 0.8, 0.6, 0.4, 0.3, 0.2],
  /** a "but" (a trait the archetype doesn't explain) needs this many points, this gap from the archetype's target, at most BUTS_SHOWN */
  BUT_MIN: 20,
  BUT_GAP: 40,
  BUTS_SHOWN: 3,
  /** the strongest values the agent is given as drives, and how many the Weaver and the player may pick */
  DRIVES_SHOWN: 3,
  /** tensions given to the agent, in table order */
  TENSIONS_SHOWN: 2,
  /** signatures a character may hold (set on the Character page), and the longest one in characters [placeholder] */
  SIGNATURES_MAX: 5,
  SIGNATURE_MAX_CHARS: 120,
  /** PL12: the Nerve points a named line sets (− for cautious, + for daring) */
  NERVE_LINE_POINTS: 40,
  /** AP2: personality points one achievement step is worth; rows write steps (+1, −1), so this one number scales them all */
  ACH_PERSONALITY_STEP: 5,
  /** [MORALE_LEVELS key, max % of max morale lost, roll penalty in % of the average roll (type wounds, MB3, PW1 b)]; broken = out of the fight */
  MORALE_TRACK: [
    ['calm', 0, 0], ['uneasy', 15, 0], ['tense', 30, 0], ['rattled', 45, -7], ['afraid', 60, -10],
    ['terrified', 75, -13], ['panicking', 99.999, -20], ['broken', Infinity, 0],
  ] as [string, number, number][],
  /** BF79: morale lost can pass max morale up to this × max; at the top the actor is Cowering (below Broken): it cowers and
   * cannot even flee. Broken runs from 100 % lost to here. [balance lever] */
  MORALE_COWER_AT: 1.2,
  /** MB6: a rolled fear's cost × this, by the morale roll's tier; each step below Critical Failure adds MORALE_BEYOND_CF */
  MORALE_TIER_MULT: { critical_failure: 2, failure: 1.5, near_miss: 1, success: 0.5, great_success: 0.25, critical_success: 0 } as Record<string, number>,
  MORALE_BEYOND_CF: 0.5,
  /** MB9: share of max morale back when an actor's engagement ends */
  MORALE_ENGAGEMENT_END_PCT: 25,
  /** a single loss of this % of max morale or more marks the player's Resolve */
  RESOLVE_MARK_PCT: 10,
  /** others' morale shows (as words) from this level down (MB16), like HEALTH_SHOWN_FROM */
  MORALE_SHOWN_FROM: 'afraid' as MoraleLevel,
  /** the sheet's morale bar spells out the stakes (roll penalty, what Broken stops) from this level down */
  MORALE_HINT_FROM: 'terrified' as MoraleLevel,
  REST_COOLDOWN_MIN: 240, // T7: game minutes between rests (placeholder)
};
