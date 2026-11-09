// Perks whose rules are coded (Ali, 07/11/2026: perks are coded, so each is built against its Rules write-up in perks.ts).
// A perk listed here can be taken; the rest show on the Perks screen but can't be taken yet.
export const BUILT_PERKS = new Set<string>([
  'hidden_strike', // A1: src/ruleset/index.ts attack()
  // All-50 parts (src/library/allPerks.ts), granted by src/ruleset/allSteps.ts
  'hunters_eye', // T2d: src/ruleset/perks.ts trueSkill() fnSkill
  'opening_strike', 'unerring', // T1a, T2a: src/engine/resolve.ts openingShifts()
  'hard_to_hold', // T3a: src/engine/held.ts breakFree()
  'iron_knuckles', 'bare_handed_guard', // T3d, T3d2: attack() in src/ruleset/index.ts; trueSkillTo
  'spotter', // T5b: src/ruleset/allSteps.ts shareSpotted()
  'soft_landing', // T7a: src/ruleset/allSteps.ts afterRollShifts()
  'fighters_frame', // T1d: attack()
  'past_the_cover', // T2c: attack()
  'child_of_night', // T6c: src/ruleset/gear.ts situational()
  'curiouser', // T5d: roll()
  'dodgy', // T4d: src/ruleset/allSteps.ts foeMods(), roll()
  'counter', // T1c: src/engine/resolve.ts allFiftyAfterAttack()
  'volley', // T2b: allFiftyAfterAttack()
  'second_wind', // T4b: allFiftyAfterAttack()
  'strike_and_fade', // T6a: allFiftyAfterAttack()
  'hushed_steps', // T6d: src/minds/state.ts stealthDetect(), allSteps.ts afterRollShifts()
  'shield_breaker', // A3: attack() and applyEffects()
  'point_blank', // A4: attack()
  'iron_frame', // A12: src/ruleset/body.ts rolePenalty()
  'read_wounds', // A13: src/views/index.ts
  'keen_ear', // A14: src/perception/index.ts
  'turn_the_blade', // A2: src/engine/perkMarks.ts
  'hunters_mark', // A5: src/engine/perkMarks.ts
  'make_them_stumble', // A10: src/engine/perkMarks.ts
  'cover_ally', // A11: src/engine/perkMarks.ts coverFor(), switch on the Perks card
  'open_hand_guard', // A7: src/ruleset/gear.ts openHandArm(), attack() and applyEffects()
  'threaten_for_answers', // A16: src/engine/speech.ts resolveSpeech()
  'hold', // A8: src/engine/held.ts, the grapple mode in src/library/data.ts
  'leg_bolt', // A6: attack(), applyEffects(), src/engine/perkMarks.ts slowed()
  'dirt_in_the_eyes', // A9: src/engine/perkMoves.ts, the Parser's perkMove
  'set_them_up', // B15 (strike 60): src/engine/perkMarks.ts markShifts() and afterAttack()
  'one_two', // B16 (improvisation 60): src/engine/resolve.ts doAttack()
  'unblinking', // B14 (sight 60, ST23): src/minds/state.ts stealthDetect()
  'quick_word', // A15 (trial): src/engine/speech.ts quickWord(), the exchange slot in resolveTurn()
  // 40/80/120 perks (40 milestone): src/library/boostPerks.ts; trueSkill() and boostMult()/boostAdd() in src/ruleset/perks.ts
  'keen_edge', 'steady_draw', 'iron_grip', 'light_feet', 'guard_drill', 'heavy_hand', 'sharp_eyes', 'armor_piercer', 'street_fighter', 'brawlers_eye', 'braced',
  'quick_mend', 'marksmans_eye', 'soft_step',
]);
