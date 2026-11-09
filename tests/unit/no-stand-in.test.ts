// Dodge and block never stand in for each other, though both have the defense function.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, standInShare } from '../../src/ruleset/gear';
import { SK } from '../../src/library/skillIds';

describe('stand-in exception pairs', () => {
  it('dodge and block never stand in for each other', () => {
    expect(standInShare(SK.dodge, SK.block)).toBe(0);
    expect(standInShare(SK.block, SK.dodge)).toBe(0);
    const s = makeVillage(), p = s.player;
    p.core.skills[SK.dodge] = { raw: 5, state: 'normal' };
    p.core.skills[SK.block] = { raw: 90, state: 'normal' };
    expect(effectiveSkill(s, p, SK.dodge).skill).toBe(SK.dodge);
    p.core.skills[SK.dodge] = { raw: 90, state: 'normal' };
    p.core.skills[SK.block] = { raw: 5, state: 'normal' };
    expect(effectiveSkill(s, p, SK.block).skill).toBe(SK.block);
  });
});
