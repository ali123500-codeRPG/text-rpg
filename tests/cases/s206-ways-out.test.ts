// BG-82: coming into the kitchen, the narration never named the cellar hatch the player was looking for
import { expect, it } from 'vitest';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-82: the Narrator names a new zone\'s ways out, never leaving out one the player is after', () => {
  expect(NARRATOR_INSTRUCTIONS).toContain('When the player character comes into a zone, name its ways out');
  expect(NARRATOR_INSTRUCTIONS).toContain('never leave out one that bears on what the player is after');
});
