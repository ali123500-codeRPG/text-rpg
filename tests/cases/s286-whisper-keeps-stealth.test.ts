// BG-202 (BF38): Happi whispered her thanks while stealthy and lost her Stealthy marker: any talking action ended stealth
// whatever its volume. Only speaking above a whisper ends it, whichever action carries the words.
import { expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import { SK } from '../../src/library/skillIds';
import { intent, play } from './w4-kit';

const talk = (volume?: 'whisper') => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  const p = place(s, 'patron_1', 'tav_common');
  s.player.zone = 'tav_common';
  s.player.pos = { x: 0.5, y: 0 }; p.pos = { x: 0, y: 0 };
  s.player.posture = 'stealthy';
  const i = intent({ action: { type: 'talk', skill: SK.persuasion, target: p.id }, spoken: 'Thank you.', addressees: [p.id], ...(volume ? { volume } : {}) });
  const sp = selectSpokespeople(s, i);
  play(s, { intent: i, spokespeople: sp, exchange: resolveSpeech(s, i, sp, createRng(1)), agentOutputs: [] });
  return s.player.posture;
};

it('BG-202: a whispered talk keeps the player stealthy', () => {
  expect(talk('whisper')).toBe('stealthy');
});

it('BG-202: talk at a normal voice still ends stealth', () => {
  expect(talk()).toBe('open');
});
