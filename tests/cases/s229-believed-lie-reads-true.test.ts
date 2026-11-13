// BG-137 (run 90): a lie the player did not see through still came with how convincing it was ("it lands clean... you
// find yourself believing every word"; a weak tie "rings hollow"), so a believed lie read differently from the truth.
// A lie gives the player no impression at all; only seeing through it gives the tell.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage } from '../harness';
import { pressedWords, TELL } from '../../src/engine/speech';

it('BG-137: a believed lie reads like the truth; a lie seen through gives only the tell', () => {
  const s = makeVillage();
  for (const tier of ['great_success', 'near_miss']) {
    const believed = { push: { type: 'deceive' }, contest: { a: { tier } } } as unknown as GameEvent;
    expect(pressedWords(believed, s.player)).toBeUndefined();
    const seen = { push: { type: 'deceive', tell: true }, contest: { a: { tier } } } as unknown as GameEvent;
    expect(pressedWords(seen, s.player)).toEqual({ took: TELL });
  }
  const threat = { push: { type: 'intimidate' }, contest: { a: { tier: 'success' } } } as unknown as GameEvent;
  expect(pressedWords(threat, s.player)?.how).toBeTruthy(); // other speech still strikes the player
});
