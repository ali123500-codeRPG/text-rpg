// A crippled essential part (head, neck) costs −5 wounds on every roll, once however many are crippled.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { woundsMods } from '../../src/ruleset';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';

const essential = (mods: { source: string; value: number }[]) => mods.filter((m) => m.source.startsWith('essential part crippled'));

describe('160 crippled essential part', () => {
  it('a crippled head or neck gives one −5 on every roll; a crippled arm does not', () => {
    const s = makeVillage();
    const p = s.player;
    expect(essential(woundsMods(s, p, SK.eyesight))).toEqual([]);
    p.core.condition.parts.left_arm = 0; // Crippled, not essential
    expect(essential(woundsMods(s, p, SK.eyesight))).toEqual([]);
    p.core.condition.parts.neck = -10; // Crippled
    for (const sk of [SK.eyesight, SK.dodge, SK.resolve]) expect(essential(woundsMods(s, p, sk)).map((m) => m.value)).toEqual([CONFIG.ESSENTIAL_CRIPPLED_PENALTY]);
    p.core.condition.parts.head = -150; // Destroyed counts too, still only once
    expect(essential(woundsMods(s, p, SK.eyesight))).toHaveLength(1);
    expect(CONFIG.ESSENTIAL_CRIPPLED_PENALTY).toBe(-5);
  });
});
