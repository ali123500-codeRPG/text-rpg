// 281 An essence that adds true skill to a skill opens that skill, whatever its tree's or its own requirements: a human
// holding Gel Patience can use Tremor. Letting the essence go closes it again; the raw-0 sheet entry stays, counting 0.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { SK } from '../../src/library/skillIds';
import { ES } from '../../src/library/essenceIds';
import { trueSkill } from '../../src/ruleset/perks';
import { skillBlock } from '../../src/ruleset/access';
import { effectiveSkill } from '../../src/ruleset';
import { removeEssence, takeEssence } from '../../src/engine/essence';
import { now } from '../../src/time';

describe('281 essences unlock their skills', () => {
  it('a human holding a Tremor essence can use Tremor (it adds to hearing) until the essence is let go', () => {
    const s = makeVillage(), p = s.player, pr = p.progression!;
    delete p.core.skills[SK.tremor];
    expect(skillBlock(p, SK.tremor)).not.toBe(''); // a snake-and-spider tree (AB19)
    pr.essenceOffers = [{ essence: ES.gel_patience, grade: 'common', points: { [SK.slam]: 4, [SK.tremor]: 2 }, turn: s.turn, source: 'foe', untilMin: now(s) + 5 }];
    const ear = effectiveSkill(s, p, SK.earshot).value;
    expect(takeEssence(s, 0, true)).toBeNull();
    expect(skillBlock(p, SK.tremor)).toBe('');
    expect(p.core.skills[SK.tremor]).toEqual({ raw: 0, state: 'normal' });
    expect(trueSkill(p, SK.tremor)).toBe(2);
    expect(effectiveSkill(s, p, SK.earshot).value).toBeCloseTo(ear + 2 * 0.5); // tremor is tier 0
    expect(removeEssence(s, 0, true)).toBeNull();
    expect(skillBlock(p, SK.tremor)).not.toBe('');
    expect(trueSkill(p, SK.tremor)).toBe(0);
  });
});
