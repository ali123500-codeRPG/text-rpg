// BG-71 (run 66): the player shouted through a barred door and nobody inside heard: the Parser had no volume for the
// player's words, so every line was said at a normal voice, lost behind a shut door. Now the Parser gives "volume"
// (whisper, normal, shout) and the line, and who answers when addressing everyone, go by it.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent } from './w4-kit';
import { selectSpokespeople } from '../../src/engine';
import { fromIntent } from '../../src/engine/merge';
import { checkIntent } from '../../src/agents/schema';

it('BG-71: a shout through the shut front door is heard by those inside; a normal voice is not', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'guard_1'] });
  place(s, 'patron_1', 'tav_common');
  const talk = (volume?: 'shout') => intent({ action: { type: 'talk' }, spoken: 'Who called for help?', addressees: ['everyone'], ...(volume ? { volume } : {}) });
  expect(selectSpokespeople(s, talk())).toEqual([]);
  expect(selectSpokespeople(s, talk('shout'))).toContain('patron_1');
  expect(fromIntent(s, talk('shout'), false).line).toMatchObject({ volume: 'shout' });
  expect(checkIntent(talk('shout')).value.volume).toBe('shout');
});
