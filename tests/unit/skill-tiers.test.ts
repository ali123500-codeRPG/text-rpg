// Skill tiers (Ali, 08/11/2026): a skill's tier sets its final efficiency multiplier, in rolls and in the rating.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill } from '../../src/ruleset';
import { effort, rating } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';

describe('skill tiers', () => {
  it('every skill is tier 2 (1×) except the slime class skills (tier 0, 0.5×)', () => {
    makeVillage();
    const skills = getLibrary().skills;
    expect(Object.values(skills).filter((s) => s.tier !== 'tier_2').map((s) => s.id).sort()).toEqual(['taste', 'tremor']);
    expect(CONFIG.SKILL_TIER_MULT.tier_0).toBe(0.5);
    expect(CONFIG.SKILL_TIER_MULT.tier_2).toBe(1);
  });
  it('a tier 0 skill counts at half in rolls and in the rating', () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    slime.core.skills.tremor = { raw: 60, state: 'normal' };
    expect(effectiveSkill(s, slime, 'tremor').value).toBe(30);
    slime.core.skills.taste = { raw: 0, state: 'normal' };
    const before = rating(slime);
    slime.core.skills.tremor = { raw: 0, state: 'normal' };
    // tremor 60 rates as a 30 (slimes can't use Perception, TA6, so a tier 2 notice skill can't stand in)
    expect(before - rating(slime)).toBeCloseTo(CONFIG.XP_CATEGORY_WEIGHT.notice * effort(30));
  });
});
