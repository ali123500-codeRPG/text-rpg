import { PK } from './perkIds';
// Perks whose rules are coded (perks are coded, so each is built against its Rules write-up in perks.ts).
// A perk listed here can be taken; the rest show on the Perks screen but can't be taken yet.
export const BUILT_PERKS = new Set<string>([
  PK.hidden_strike, // A1: src/ruleset/index.ts attack()
  PK.never_surprised, // C1 (Earshot 100): src/engine/resolve.ts initiativeOrder() and doAttack(), via hears() in src/perception
  // All-50 parts (src/library/allPerks.ts), granted by src/ruleset/allSteps.ts
  PK.hunters_eye, // T2d: src/ruleset/perks.ts trueSkill() fnSkill
  PK.opening_strike, PK.unerring, // T1a, T2a: src/engine/resolve.ts openingShifts()
  PK.hard_to_hold, // T3a: src/engine/held.ts breakFree()
  PK.iron_knuckles, PK.bare_handed_guard, // T3d, T3d2: attack() in src/ruleset/index.ts; trueSkillTo
  PK.spotter, // T5b: src/ruleset/allSteps.ts shareSpotted()
  PK.steady_guard, PK.thick_hide, // T1e, T4e: attack() in src/ruleset/index.ts; trueSkillTo
  PK.night_eyes, // T5e: src/ruleset/gear.ts situational()
  PK.easy_speaker, // T7d: src/engine/speech.ts resolveSpeech(), the listener's answering roll
  PK.soft_landing, // T7a: src/ruleset/allSteps.ts afterRollShifts()
  PK.silver_words, // T7e: trueSkillTo
  PK.fighters_frame, // T1d: attack()
  PK.past_the_cover, // T2c: attack()
  PK.child_of_night, // T6c: src/ruleset/gear.ts situational()
  PK.curiouser, // T5d: roll()
  PK.dodgy, // T4d: src/ruleset/allSteps.ts foeMods(), roll()
  PK.counter, // T1c: src/engine/resolve.ts allFiftyAfterAttack()
  PK.volley, // T2b: allFiftyAfterAttack()
  PK.second_wind, // T4b: allFiftyAfterAttack()
  PK.strike_and_fade, // T6a: allFiftyAfterAttack()
  PK.hushed_steps, // T6d: src/minds/state.ts stealthDetect(), allSteps.ts afterRollShifts()
  PK.shield_breaker, // A3: attack() and applyEffects()
  PK.point_blank, // A4: attack()
  PK.iron_frame, // A12: src/ruleset/body.ts rolePenalty()
  PK.read_wounds, // A13: src/views/index.ts
  PK.keen_ear, // A14: src/perception/index.ts
  PK.haggler, // A17 Hard Bargain (PY10, SL10): src/engine/trade.ts warePrice() and sellPrice()
  PK.turn_the_blade, // A2: src/engine/perkMarks.ts
  PK.hunters_mark, // A5: src/engine/perkMarks.ts
  PK.make_them_stumble, // A10: src/engine/perkMarks.ts
  PK.cover_ally, // A11: src/engine/perkMarks.ts coverFor(), switch on the Perks card
  PK.open_hand_guard, // A7: src/ruleset/gear.ts openHandArm(), attack() and applyEffects()
  PK.threaten_for_answers, // A16: src/engine/speech.ts resolveSpeech()
  PK.hold, // A8: src/engine/held.ts, the grapple mode in src/library/data.ts
  PK.leg_bolt, // A6: attack(), applyEffects(), src/engine/perkMarks.ts slowed()
  PK.soft_tread, PK.quiet_mail, // A18, A21: src/engine/resolve.ts armorNoise()
  PK.melt_away, // A19: src/engine/resolve.ts setPosture(), src/agents/legality.ts
  PK.in_and_out, // A23: src/engine/resolve.ts doAttack()
  PK.blade_wall, // B19: attack() in src/ruleset/index.ts
  PK.slip_the_blow, PK.turn_aside, // A20, A22: attack() in src/ruleset/index.ts
  PK.dirt_in_the_eyes, // A9: src/engine/perkMoves.ts, the Parser's perkMove
  PK.set_them_up, // B15 (strike 60): src/engine/perkMarks.ts markShifts() and afterAttack()
  PK.one_two, // B16 (improvisation 60): src/engine/resolve.ts doAttack()
  PK.unblinking, // B14 (sight 60, ST23): src/minds/state.ts stealthDetect()
  PK.quick_word, // A15 (trial): src/engine/speech.ts quickWord(), the exchange slot in resolveTurn()
  // 40/80/120 perks (40 milestone): src/library/boostPerks.ts; trueSkill() and boostMult()/boostAdd() in src/ruleset/perks.ts
  PK.keen_edge, PK.steady_draw, PK.iron_grip, PK.light_feet, PK.guard_drill, PK.heavy_hand, PK.sharp_eyes, PK.armor_piercer, PK.street_fighter, PK.brawlers_eye, PK.braced,
  PK.quick_mend, PK.marksmans_eye, PK.soft_step,
]);
