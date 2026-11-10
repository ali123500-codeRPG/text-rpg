// 147 Merchant (tier 1) unlocks through the Trader (tier 0) capstone Known at Every Stall, granted at Trader's top level. Its skill Shrewd Dealing augments Barter: its true skill
// (× share × tier) is added to every roll that asks for Barter. Augments can be limited to roll kinds.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { augmentsOf, effectiveSkill } from '../../src/ruleset';
import { awardXp, unlockClasses, xpToNext } from '../../src/engine/xp';
import { classMaxLevel } from '../../src/library/spawn';
import { PK } from '../../src/library/perkIds';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { CL } from '../../src/library/classIds';

describe('147 Merchant and skill augments', () => {
  it('Trader is tier 0, Merchant tier 1; the Trader capstone unlocks Merchant', () => {
    const s = makeVillage(), p = s.player, lib = getLibrary();
    expect([lib.classes[CL.trader].tier, lib.classes[CL.merchant].tier]).toEqual(['tier_0', 'tier_1']);
    expect([classMaxLevel(CL.trader), classMaxLevel(CL.merchant)]).toEqual([5, 10]);
    expect(lib.classes[CL.trader].capstone).toEqual([PK.known_at_every_stall]);
    p.core.classes = [{ classId: CL.trader, state: 'current', level: 4 }];
    p.core.perks = [];
    unlockClasses(s);
    expect(p.core.classes.some((c) => c.classId === CL.merchant)).toBe(false);
    awardXp(s, xpToNext(p), 'test'); // Trader 4 → 5, its top level: the capstone comes and unlocks Merchant
    expect(p.core.perks.map((x) => x.perkId)).toContain(PK.known_at_every_stall);
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
