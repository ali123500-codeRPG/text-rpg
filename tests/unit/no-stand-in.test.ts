// Ali (09/11/2026): dodge and block never stand in for each other, though both have the defense function.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, standInShare } from '../../src/ruleset/gear';

describe('stand-in exception pairs', () => {
  it('dodge and block never stand in for each other', () => {
    expect(standInShare('dodge', 'block')).toBe(0);
    expect(standInShare('block', 'dodge')).toBe(0);
    const s = makeVillage(), p = s.player;
    p.core.skills.dodge = { raw: 5, state: 'normal' };
    p.core.skills.block = { raw: 90, state: 'normal' };
    expect(effectiveSkill(s, p, 'dodge').skill).toBe('dodge');
    p.core.skills.dodge = { raw: 90, state: 'normal' };
    p.core.skills.block = { raw: 5, state: 'normal' };
    expect(effectiveSkill(s, p, 'block').skill).toBe('block');
  });
});
