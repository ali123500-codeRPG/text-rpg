// BG-134 (runs 91, 92): the Parser wrote "deferred" in its own words ("ask hask who else claims they saw the player play
// dice", "Four coppers up front: no payee or ware named, so not yet applied"), and that text was offered back to the player
// as what they put off. Deferred is written as the player would type it next turn: their voice, people named as the
// player knows them, never ids, "the player" or notes.
import { expect, it } from 'vitest';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-134: the Parser writes deferred in the player\'s own words', () => {
  expect(PARSER_INSTRUCTIONS).toContain('write it as the player would type it next turn, in their own voice');
  expect(PARSER_INSTRUCTIONS).toContain('never an id, never "the player", and never your own notes or reasons');
});
