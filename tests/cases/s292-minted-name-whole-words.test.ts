// 292 (BG-212): a minted reward's name and look are checked for hidden terms as whole words, as every other public
// text in a stage plan is (V10). A hidden term inside a longer word ("rat" in "pirate") is no leak, so the item is minted.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { validateStagePlan } from '../../src/scenario';
import { tidyRewards } from '../../src/scenario/validate';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { IT } from '../../src/library/itemIds';

describe('292 BG-212 minted names: hidden terms as whole words', () => {
  const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
  const plan = (name: string) => {
    const p = villageStagePlan('success');
    p.hiddenTerms = [...(p.hiddenTerms ?? []), 'rat'];
    p.rewards.push({ item: { base: IT.arming_sword, quality: 'quality_2', boosts: 'hitAdj', name, look: 'a well-kept blade' }, place: { carriedBy: 'guard_1' } });
    return p;
  };
  it('"rat" inside "pirate" does not stop the sword being minted; the whole word still does: "the rat\'s blade" is not minted (TI-220b: dropped, as plain rewards come from the draw)', () => {
    const s = toStoryStart(makeVillage());
    const p = plan('a pirate\'s sword');
    expect(validateStagePlan(s, p, ctx).map((e) => e.code)).not.toContain('reward_dropped');
    expect(tidyRewards(s, p).rewards.some((r) => typeof r.item === 'object')).toBe(true);
    expect(tidyRewards(s, plan('the rat\'s blade')).notes.find((n) => n.code === 'reward_dropped')?.message).toContain('hidden term');
  });
});
