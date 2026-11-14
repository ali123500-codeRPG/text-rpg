// 285 BG-200 (BF26): saying you aim at a part aims the attack, as the Aim button does. "I aim at his other leg and
// shoot" with the button off was rolled unaimed, so the leg the player named made no difference.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { fromIntent } from '../../src/engine/merge';
import { checkIntent } from '../../src/agents/schema';
import { SK } from '../../src/library/skillIds';
import type { Intent } from '../../src/types';

const shot = (action: Record<string, unknown>): Intent => checkIntent({ action: { type: 'attack', skill: SK.ranged_light, target: 'patron_1', ...action } }).value;

describe('282 words aim (BG-200, BF26)', () => {
  it('"aim at his leg" (aimed with a part) aims the attack with the Aim button off', () => {
    const s = makeVillage();
    expect(fromIntent(s, shot({ targetPart: 'left_leg', aimed: true }), false).aimed).toBe(true);
  });
  it('a part named in passing, or "aimed" with no part, stays unaimed; the Aim button still aims', () => {
    const s = makeVillage();
    expect(fromIntent(s, shot({ targetPart: 'left_leg' }), false).aimed).toBe(false);
    expect(fromIntent(s, shot({ aimed: true }), false).aimed).toBe(false);
    expect(fromIntent(s, shot({ targetPart: 'left_leg' }), true).aimed).toBe(true);
  });
});
