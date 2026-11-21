// 426 The Weaver places code's reward draw (TI-220b b) and the budget past Critical (D-216c a). Code draws a stage
// plan's plain rewards from RW6, seeded so the Weaver's view and the check of its plan see the same draw. Minted items
// come first; then each drawn item, in order, that still fits. A plain reward outside the draw is dropped, and a drawn
// one left unplaced goes where the drawn reward before it went. Past Critical Success the budget grows by
// BOON_PAST_CRIT_MULT a step; past Critical Failure the challenge is Extreme only.
import { describe, expect, it } from 'vitest';
import { makeVillage, withDrawOf } from '../harness';
import { CONFIG } from '../../src/config';
import { boon, gradesFitTier, rewardDraw, tidyRewards } from '../../src/scenario/validate';
import { boonBudget } from '../../src/scenario/boon';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { IT } from '../../src/library/itemIds';
import { WEAVER_SHAPE } from '../../src/agents/prompts';

const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };

describe('426 the Weaver places the reward draw', () => {
  it('the draw is the same each time it is read, differs per call, and fills at most the tier\'s top budget', () => {
    const s = toStoryStart(makeVillage());
    const d = rewardDraw(s, ctx);
    expect(rewardDraw(s, ctx)).toEqual(d);
    expect(d.reduce((n, r) => n + r.boon, 0)).toBeLessThanOrEqual(CONFIG.BOON_BUDGET.extreme * (1 + CONFIG.VOW_REWARD_MARGIN));
    expect(rewardDraw(s, { ...ctx, kind: 'extension', frontierKey: 'deep_woods' })).not.toEqual(d);
    expect(rewardDraw(s, { ...ctx, world: true })).toEqual([]);
  });

  it('minted items come first; then drawn items fill what is left; a plain reward outside the draw is dropped', () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan('success'); // moderate gain: a budget of 5
    const each = boon(s, IT.healing_draught);
    p.rewards = [
      { item: IT.healing_draught, place: { carriedBy: 'guard_1' } },
      { item: IT.dagger, place: { carriedBy: 'guard_1' } }, // not drawn
      { item: { base: IT.dagger, quality: 'quality_1', boosts: 'hitAdj', name: 'Thorn', look: 'a thin blade' }, place: { carriedBy: 'barkeep' } },
    ];
    const minted = boon(s, p.rewards[2].item);
    const r = withDrawOf(IT.healing_draught, () => tidyRewards(s, p, ctx));
    expect(r.notes.find((n) => n.message.includes(IT.dagger) && n.code === 'reward_dropped')).toBeDefined();
    expect(r.rewards.filter((x) => typeof x.item === 'object')).toHaveLength(1);
    const drawn = r.rewards.filter((x) => x.item === IT.healing_draught);
    expect(drawn.length).toBe(Math.floor((CONFIG.BOON_BUDGET.moderate - minted) / each + 1e-9));
    // the draughts the plan did not place go with the one it placed
    expect(new Set(drawn.map((x) => (x.place as { carriedBy?: string }).carriedBy))).toEqual(new Set(['guard_1']));
  });

  it('the prompt tells the Weaver to place the draw', () => {
    expect(WEAVER_SHAPE).toContain('WEAVER_VIEW.rewardDraw');
  });
});

describe('426 danger and reward past Critical (D-216c a)', () => {
  it('the Boon budget grows by BOON_PAST_CRIT_MULT for each step past Critical Success', () => {
    const s = makeVillage();
    s.stage.tier = 'critical_success';
    expect(boonBudget(s, 'extreme', 'critical_success')).toBe(CONFIG.BOON_BUDGET.extreme);
    s.stage.tierBeyond = 1;
    expect(boonBudget(s, 'extreme', 'critical_success')).toBe(CONFIG.BOON_BUDGET.extreme * CONFIG.BOON_PAST_CRIT_MULT);
    s.stage.tierBeyond = 2;
    expect(boonBudget(s, 'extreme', 'critical_success')).toBe(CONFIG.BOON_BUDGET.extreme * CONFIG.BOON_PAST_CRIT_MULT ** 2);
    expect(boonBudget(s, 'extreme', 'success')).toBe(CONFIG.BOON_BUDGET.extreme); // only the running scenario's own tier
  });

  it('past Critical Failure the challenge is Extreme only', () => {
    expect(gradesFitTier('critical_failure', 'major', 'none')).toBe(true);
    expect(gradesFitTier('critical_failure', 'major', 'none', -1)).toBe(false);
    expect(gradesFitTier('critical_failure', 'extreme', 'none', -2)).toBe(true);
  });
});
