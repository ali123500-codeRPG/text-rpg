// BG-135 (run 75h, turn 43): "I turn toward the back door to see what moved there" aimed the look at the common room
// behind the shut back door, not at the half-seen someone by it in the yard, so the story told only of the shut door.
// A look aims at someone in view (half seen too) or a zone the player can see into, never the room beyond a shut way.
import { expect, it } from 'vitest';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-135: a look at what moved by a door aims at that someone, never the room beyond', () => {
  expect(PARSER_INSTRUCTIONS).toContain('A look aims at what the player looks at: someone in PLAYER_VIEW (one half seen, \"someone\", included)');
  expect(PARSER_INSTRUCTIONS).toContain('never the room beyond a shut way');
});
