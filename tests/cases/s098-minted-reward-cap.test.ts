// 98 Minted reward cap: a quality-3 variant on a moderate-gain scenario is lowered to quality 2, and a weapon with
// an unknown boosts gets hitAdj (V7, run 2's "keen edge"). Both are repaired notes, so the plan still applies (loot L1).
import { describe, expect, it, vi } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan, ScenarioDirector, validateStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';
import { ruleset } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';

describe('98 Minted reward cap', () => {
  const ctx = { tier: 'success' as const, kind: 'scenario' as const, placeId: 'tavern' };
  const withSword = (quality: 1 | 2 | 3 | 4, boosts = 'hitAdj') => {
    const p = villageStagePlan('success');
    expect(p.event.gain).toBe('moderate');
    p.rewards.push({ item: { base: IT.arming_sword, quality, boosts, name: 'a watchman\'s sword', look: 'a well-kept blade' }, place: { carriedBy: 'guard_1' } });
    return p;
  };
  it('quality 2 passes clean; quality 3 is lowered to 2 without blocking', () => {
    expect(validateStagePlan(toStoryStart(makeVillage()), withSword(2), ctx)).toEqual([]);
    expect(validateStagePlan(toStoryStart(makeVillage()), withSword(3), ctx)).toEqual([expect.objectContaining({ code: 'reward_quality', repaired: true })]);
  });
  it('an unknown weapon boosts becomes hitAdj and the sword is minted at the capped quality', () => {
    const s = toStoryStart(makeVillage());
    const p = withSword(3, 'keen edge');
    expect(validateStagePlan(s, p, ctx).map((e) => e.code)).toEqual(['reward_quality', 'reward_boosts']);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const def = s.blueprints.find((b) => b.kind === 'item')!.data as { base: { quality: number; boosts: string }; weapon: { modes: { hitAdj?: number }[] } };
    expect(def.base).toMatchObject({ quality: 2, boosts: 'hitAdj' });
    expect(def.weapon.modes[0].hitAdj).toBe(4); // QUALITY_HIT_FACTOR 0.04 × need 50 (fine) × quality 2
    expect(s.log.some((l) => l.code === 'reward_repaired')).toBe(true);
  });
  it('run 2: a plan whose only faults are rewards applies at once, with no repair call', async () => {
    const roll = vi.spyOn(ruleset, 'eventRoll').mockReturnValue({ actorId: 'player', roll: 60, tier: 'success', modifiers: [] });
    const weave = vi.fn(async () => withSword(3, 'keen edge'));
    const r = await new ScenarioDirector({ weave, clock: new VirtualClock() }).startScenario(makeVillage(), createRng(1));
    expect(weave).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe('applied');
    roll.mockRestore();
  });
});
