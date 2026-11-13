// BG-154 (runs 100b t9, 95 t4): a whisper across the counter, 2.5 m, to Marta named only as its addressee (no target, no
// line.to) was never raised to reach her, so she asked to hear it again. A whisper is said low enough for each one it is
// for: line.to, a speak's target, and everyone it addresses.
import { expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';

it('a whisper reaches the person it addresses', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  beside(s, 'patron_1', 'player', 2.5);
  play(s, { intent: intent({ action: { type: 'talk', target: null }, spoken: 'What\'s the small matter?', volume: 'whisper', addressees: ['patron_1'] }) });
  expect(s.log.some((l) => l.code === 'whisper_raised' && l.detail?.to === 'patron_1')).toBe(true);
});
