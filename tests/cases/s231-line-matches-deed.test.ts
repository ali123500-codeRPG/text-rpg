// BG-140 (runs 86b, 93) and BG-136 (runs 77g, 91): a Responder voiced a deed its action did not do. Marta "poured" a
// free drink with a talk action, so there was no cup; Wick said he would stand aside and never moved; Wennick said
// "right behind you" but walked on alone to the north road (headTo) instead of following. The line never claims a deed
// the action does not do, and going somewhere with the player is the follow routine.
import { expect, it } from 'vitest';
import { PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-140, BG-136: an NPC line never claims a deed its action does not do', () => {
  for (const p of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS]) {
    expect(p).toContain('Your line never says you do something this turn that your action does not do');
  }
  expect(RESPONDER_INSTRUCTIONS).toContain('Going somewhere with the\n   player is follow, never headTo');
});
