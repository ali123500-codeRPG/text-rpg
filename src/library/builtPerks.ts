// Perks whose rules are coded (Ali, 07/11/2026: perks are coded, so each is built against its Rules write-up in perks.ts).
// A perk listed here can be taken; the rest show on the Perks screen but can't be taken yet.
export const BUILT_PERKS = new Set<string>([
  'hidden_strike', // A1: src/ruleset/index.ts attack()
  'shield_breaker', // A3: attack() and applyEffects()
  'point_blank', // A4: attack()
  'iron_frame', // A12: src/ruleset/body.ts rolePenalty()
  'read_wounds', // A13: src/views/index.ts
  'keen_ear', // A14: src/perception/index.ts
]);
