// The fixed skill pairs of contests that always roll the same two skills. The engine rolls these and the library
// viewer's Actions tab shows them, so a change here changes both. Speech contests come from SPEECH_SKILL and
// answerSkill (src/engine/speech.ts) instead. `roll` is the one who acts, `against` the one who answers.
import { SK } from './skillIds';

export const CONTEST = {
  /** observe a person clearly seen: the looker's Insight against the face they keep (sizeUp, src/engine/speech.ts) */
  size_up: { roll: SK.insight, against: SK.lying },
  /** Dirt in the Eyes: a throw of what is at hand against a dodge (src/engine/perkMoves.ts) */
  dirt_in_the_eyes: { roll: SK.unarmed_improvised, against: SK.dodge },
  /** Draw Them In: a false opening against each foe's read of it (doDrawThemIn, src/engine/resolve.ts) */
  draw_them_in: { roll: SK.stratagem, against: SK.insight },
  /** Play Dead: the body's lie; answered as a deceit is (src/engine/playDead.ts) */
  play_dead: { roll: SK.guile },
  /** restrain: a grab against the better of the held one's grapple or dodge (src/engine/held.ts) */
  restrain: { roll: SK.unarmed_grapple, against: [SK.unarmed_grapple, SK.dodge] },
} as const;
