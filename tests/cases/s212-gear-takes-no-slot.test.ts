// BG-96: "pick up the draught, then ask the tinker why he shouted" deferred the question, though picking up costs nothing
import { expect, it } from 'vitest';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-96: gear takes neither the move nor the action, so words beside it are never deferred', () => {
  expect(PARSER_INSTRUCTIONS).toContain('Gear (rule 9) takes neither slot');
  expect(PARSER_INSTRUCTIONS).toContain('the pick-up goes in "gear" and the question in "spoken"');
  expect(PARSER_INSTRUCTIONS).toContain('picking things\n   up go in "gear"; they cost nothing');
});
