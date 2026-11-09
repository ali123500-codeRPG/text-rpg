// 124 Skill groups and functions (F1–F8): a skill lists one or more narrow functions (stand-ins at
// SUBSTITUTE_EFFICIENCY 0.3, which perks can move); each function sits in one broad group (40 perk +1, XP category).
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, trueSkill } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { Actor } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const only = (a: Actor, skills: Record<string, number>) => {
  for (const id of Object.keys(a.core.skills)) delete a.core.skills[id];
  for (const [id, raw] of Object.entries(skills)) a.core.skills[id] = { raw, state: 'normal' };
};
afterEach(() => { delete getLibrary().perks.test_stand_in; });

describe('124 skill groups and functions', () => {
  it('F1/F6: tremor has both the sight and hearing functions; F8: XP categories unchanged', () => {
    const k = getLibrary().skills;
    expect(k.tremor.functions).toEqual(['sight', 'hearing']);
    expect([k.melee_light.xpCategory, k.unarmed_strike.xpCategory, k.ranged_heavy.xpCategory]).toEqual(['offensive', 'offensive', 'offensive']);
    expect([k.dodge.xpCategory, k.endurance.xpCategory, k.sight.xpCategory, k.tremor.xpCategory, k.barter.xpCategory]).toEqual(['defensive', 'endurance', 'notice', 'notice', 'influence']);
    expect(getLibrary().trees.melee.name).toBe('Combat – Arms'); // F7
  });
  it('F4: sight and hearing no longer stand in for each other; tremor stands in for both', () => {
    const s = makeVillage();
    only(s.player, { sight: 80 });
    expect(effectiveSkill(s, s.player, 'hearing').value).toBe(0);
    only(s.player, { hearing: 80 });
    expect(effectiveSkill(s, s.player, 'sight').value).toBe(0);
    const slime = s.actors.find((a) => a.core.raceId === 'slime')!;
    only(slime, { tremor: 50 });
    // tremor is tier 0 (×0.5) on top of the 0.3 stand-in share
    for (const sense of ['sight', 'hearing']) expect(effectiveSkill(s, slime, sense)).toMatchObject({ skill: 'tremor', value: 50 * CONFIG.SUBSTITUTE_EFFICIENCY * 0.5 });
  });
  it('F1: a 40 perk in a weapon skill gives +1 to every Melee skill, unarmed included, and not to Ranged', () => {
    const s = makeVillage();
    only(s.player, { melee_light: 40, unarmed_strike: 10, unarmed_natural: 10, ranged_light: 10 });
    give(s.player, 'keen_edge');
    expect([trueSkill(s.player, 'melee_light'), trueSkill(s.player, 'unarmed_strike'), trueSkill(s.player, 'ranged_light')]).toEqual([46, 11, 10]);
  });
  it('F4: a perk can move the stand-in share, kept within 0–1', () => {
    const s = makeVillage();
    only(s.player, { persuasion: 100 });
    expect(effectiveSkill(s, s.player, 'barter').value).toBeCloseTo(30);
    getLibrary().perks.test_stand_in = { id: 'test_stand_in', name: 'test', standIn: { add: 0.2, fn: 'influence' } };
    give(s.player, 'test_stand_in');
    expect(effectiveSkill(s, s.player, 'barter').value).toBeCloseTo(50);
    expect(effectiveSkill(s, s.player, 'sight').value).toBe(0); // another function: unchanged
    getLibrary().perks.test_stand_in.standIn = { add: 5 };
    expect(effectiveSkill(s, s.player, 'barter').value).toBeCloseTo(100);
  });
});
