// BG-79: a place the player asks to go beside an action fills the turn's move; the Parser must not defer it
import { expect, it } from 'vitest';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-79: the Parser rule keeps a move beside an action and names spots without ids by someone there', () => {
  expect(PARSER_INSTRUCTIONS).toContain('fills the turn\'s move: never defer it because there is an action');
  expect(PARSER_INSTRUCTIONS).toContain('is named by someone there (spot near them) or a side');
});
