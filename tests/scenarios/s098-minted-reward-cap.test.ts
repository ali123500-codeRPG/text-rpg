// 98 Minted reward cap: a Weaver plan with a quality-3 variant on a moderate-gain scene fails validation; quality 2 passes.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';

describe('98 Minted reward cap', () => {
  const ctx = { tier: 0, kind: 'scene' as const, placeId: 'tavern' };
  const withSword = (quality: 1 | 2 | 3 | 4) => {
    const p = villageStagePlan(0);
    expect(p.event.gain).toBe('moderate');
    p.rewards.push({ item: { base: 'arming_sword', quality, boosts: 'hitAdj', name: 'a watchman\'s sword', look: 'a well-kept blade' }, place: { carriedBy: 'guard_1' } });
    return p;
  };
  it('quality 3 fails, quality 2 passes', () => {
    expect(validateStagePlan(toStoryStart(makeVillage()), withSword(3), ctx)).toEqual([expect.objectContaining({ code: 'minted_quality' })]);
    expect(validateStagePlan(toStoryStart(makeVillage()), withSword(2), ctx)).toEqual([]);
  });
});
