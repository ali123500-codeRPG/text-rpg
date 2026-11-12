// BG-97: the narration called a "she" player "a boy of thirteen": no view carried the player's pronouns, so agents guessed from the name
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildNarrationView, buildPlayerView, buildWeaverView } from '../../src/views';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';

it('BG-97: every view that describes the player carries their pronouns', () => {
  const s = makeVillage();
  s.player.pronouns = 'she';
  expect(buildNarrationView(s, []).player.pronouns).toBe('she');
  expect(buildPlayerView(s).player.pronouns).toBe('she');
  expect(buildWeaverView(s, { kind: 'plan' } as never).player.pronouns).toBe('she');
  expect(NARRATOR_INSTRUCTIONS).toContain("The player character's own are in player.pronouns. Never guess anyone's from a name.");
});
