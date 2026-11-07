// Perks whose rules are coded (Ali, 07/11/2026: perks are coded, so each is built against its Rules write-up in perks.ts).
// A perk listed here can be taken; the rest show on the Perks screen but can't be taken yet.
export const BUILT_PERKS = new Set<string>([
  'hidden_strike', // A1: src/ruleset/index.ts attack()
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
]);
