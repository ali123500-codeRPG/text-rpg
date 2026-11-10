// 147 Merchant (tier 2) unlocks when Trader reaches level 10. Its skill Shrewd Dealing augments Barter: its true skill
// (× share × tier) is added to every roll that asks for Barter. Augments can be limited to roll kinds.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { augmentsOf, effectiveSkill } from '../../src/ruleset';
import { unlockClasses } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';

describe('147 Merchant and skill augments', () => {
  it('Merchant is tier 2 and unlocks at Trader 10, not before', () => {
    const s = makeVillage(), p = s.player;
    expect(getLibrary().classes[CL.merchant].tier).toBe('tier_2');
    p.core.classes.push({ classId: CL.trader, state: 'previous', level: 9 });
    unlockClasses(s);
    expect(p.core.classes.some((c) => c.classId === CL.merchant)).toBe(false);
    p.core.classes.find((c) => c.classId === CL.trader)!.level = 10;
    unlockClasses(s);
    expect(p.core.classes).toContainEqual({ classId: CL.merchant, state: 'unlocked', level: 0 });
  });

  it('Shrewd Dealing adds to every Barter roll once the Merchant tree is open; other skills are untouched', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills[SK.barter] = { raw: 30, state: 'normal' };
    p.core.skills[SK.shrewd_dealing] = { raw: 20, state: 'normal' };
    const closed = effectiveSkill(s, p, SK.barter).value; // no Merchant class: the tree is closed, so no augment
    p.core.classes.push({ classId: CL.merchant, state: 'current', level: 1 });
    expect(effectiveSkill(s, p, SK.barter).value).toBeCloseTo(closed + 20);
    expect(augmentsOf(p, SK.persuasion)).toEqual([]);
  });

  it('an augment limited to roll kinds applies only to those rolls', () => {
    const s = makeVillage(), p = s.player;
    const lib = getLibrary();
    lib.skills[SK.shrewd_dealing].augments = [{ skill: SK.barter, share: 0.5, rollKinds: ['situation'] }];
    p.core.skills[SK.shrewd_dealing] = { raw: 20, state: 'normal' };
    p.core.classes.push({ classId: CL.merchant, state: 'current', level: 1 });
    expect(augmentsOf(p, SK.barter)).toEqual([]);
    expect(augmentsOf(p, SK.barter, 'situation').map((a) => a.value)).toEqual([10]);
  });
});
