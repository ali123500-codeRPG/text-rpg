// 302 D-3 (CS21): the training cap (SKILL_CAP, tagged and flawed caps) limits raw skill only. True skill and effective
// skill pass it with no top: a perk on a capped skill carries true skill past the cap, and gear carries effective skill
// further. Conditions are roll modifiers, never a step of effective skill.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { trueSkill } from '../../src/ruleset/perks';
import { effectiveSkill, skillCap } from '../../src/ruleset';
import { BOOST_PERKS } from '../../src/library/boostPerks';

describe('302 no cap past training', () => {
  it('a skill trained to its cap goes past it in true and effective skill', () => {
    const s = makeVillage();
    const p = s.player;
    const perk = BOOST_PERKS.find((x) => x.trueSkill && p.core.skills[x.ladder!.skill] && x.ladder!.milestone === 40)!;
    const sk = perk.ladder!.skill;
    const e = p.core.skills[sk];
    e.raw = skillCap(e);
    p.core.perks.push({ perkId: perk.id, source: 'level', gainedTurn: 0 });
    expect(e.raw).toBe(skillCap(e));
    expect(trueSkill(p, sk)).toBeGreaterThan(skillCap(e));
    expect(effectiveSkill(s, p, sk).value).toBeGreaterThan(skillCap(e));
  });
});
