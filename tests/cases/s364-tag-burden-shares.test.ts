// D-374 TB1 (Tags and Burden): each skill's raw counts toward Burden's Total at a share: 100% less 95% for its
// own tag, less 5% per tagged skill sharing a group with it (itself included). A lone tag counts 0; two tags in a group count below 0.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { burdenOf, burdenParts, groupRollBonus, growthRoll } from '../../src/ruleset/improve';
import { trueSkill } from '../../src/ruleset/perks';
import { burdenShare } from '../../src/ruleset/burdenTotal';

describe('D-374: tags in the Total', () => {
  const self = CONFIG.TAG_BURDEN_SELF_PCT / 100, mate = CONFIG.TAG_BURDEN_GROUP_PCT / 100;

  it('shares: a lone tag 0, its group-mates less 5%, other groups in full, two tags below 0', () => {
    expect(burdenShare(SK.block, [SK.block])).toBe(0);
    expect(burdenShare(SK.dodge, [SK.block])).toBeCloseTo(1 - mate); // dodge shares Defense with block
    expect(burdenShare(SK.persuasion, [SK.block])).toBe(1);
    expect(burdenShare(SK.block, [SK.block, SK.dodge])).toBeCloseTo(1 - self - 2 * mate);
    expect(burdenShare(SK.block, [SK.block, SK.dodge])).toBeLessThan(0);
  });

  it('the Total and Burden follow the shares (the hub page example)', () => {
    const p = makeVillage().player;
    p.progression!.potential = { base: 300, adjustments: [] };
    const influence = { [SK.persuasion]: { raw: 80, state: 'normal' as const }, [SK.barter]: { raw: 80, state: 'normal' as const },
      [SK.intimidation]: { raw: 80, state: 'normal' as const }, [SK.sneaking]: { raw: 80, state: 'normal' as const } };
    p.core.skills = { [SK.block]: { raw: 60, state: 'tagged' }, [SK.dodge]: { raw: 60, state: 'normal' }, [SK.light_armor]: { raw: 40, state: 'normal' }, ...influence };
    expect(burdenParts(p).total).toBeCloseTo(320 + 60 * (1 - mate) + 40 * (1 - mate)); // 415 at the placeholders
    p.core.skills[SK.dodge].state = 'tagged';
    expect(burdenParts(p).total).toBeCloseTo(320 + 2 * 60 * (1 - self - 2 * mate) + 40 * (1 - 2 * mate)); // 350
    expect(burdenOf(p)).toBe(Math.max(0, Math.floor((burdenParts(p).total - 300) / CONFIG.K))); // 2
  });
});

describe('D-374 TB5: tagged group-mates help the roll', () => {
  it('each other tagged skill in the group adds TAG_GROUP_ROLL_SHARE × its true skill; a skill never helps itself', () => {
    const p = makeVillage().player;
    p.core.skills = { [SK.block]: { raw: 100, state: 'tagged' }, [SK.dodge]: { raw: 50, state: 'normal' }, [SK.persuasion]: { raw: 50, state: 'normal' } };
    const share = CONFIG.TAG_GROUP_ROLL_SHARE * trueSkill(p, SK.block);
    expect(groupRollBonus(p, SK.dodge)).toBeCloseTo(share);
    expect(groupRollBonus(p, SK.block)).toBe(0);
    expect(groupRollBonus(p, SK.persuasion)).toBe(0);
  });

  it('the bonus adds to the room in the roll, tagged or not', () => {
    expect(growthRoll(45, { raw: 50, state: 'normal' }, 0).gain).toBe(0); // margin 45 + 50 − 100 = −5
    expect(growthRoll(45, { raw: 50, state: 'normal' }, 0, undefined, 5).gain).toBe(2); // +5: margin 0, Success
    expect(growthRoll(25, { raw: 50, state: 'tagged' }, 0, undefined, 5).gain).toBe(2); // 25 + 70 + 5 − 100 = 0
  });
});
