// Skill tiers: a skill's tier sets its final efficiency multiplier, in rolls and in the rating.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill } from '../../src/ruleset';
import { groupRating } from '../../src/ruleset/ratings';
import { SK } from '../../src/library/skillIds';
import { BT, RC } from '../../src/library/raceIds';
import { GR } from '../../src/library/functionIds';

describe('skill tiers', () => {
  it('a tier 0 skill counts at half in rolls and in the rating', () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    Object.assign(slime.core, { raceId: RC.spider, bodyTypeId: BT.eight_legged }); // AB19: Tremor is for snakes and spiders
    delete slime.core.skills[SK.scent];
    slime.core.skills[SK.tremor] = { raw: 60, state: 'normal' };
    expect(effectiveSkill(s, slime, SK.tremor).value).toBe(30);
    // tremor 60 counts as a 30 in the Notice rating
    expect(groupRating(s, slime, GR.notice).parts.find((x) => x.skill === SK.tremor)?.value).toBeCloseTo(30, 6);
  });
});
