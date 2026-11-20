// 124 Skill groups and functions (F1–F8): a skill lists one or more narrow functions (stand-ins at
// SUBSTITUTE_EFFICIENCY 0.3, which perks can move); each function sits in one broad group (40 perk +1, XP category).
import { BT, RC } from '../../src/library/raceIds';
import { FN } from '../../src/library/functionIds';
import { afterEach, describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, trueSkill } from '../../src/ruleset';
import { getLibrary } from '../../src/library';
import type { Actor } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const only = (a: Actor, skills: Record<string, number>) => {
  for (const id of Object.keys(a.core.skills)) delete a.core.skills[id];
  for (const [id, raw] of Object.entries(skills)) a.core.skills[id] = { raw, state: 'normal' };
};
afterEach(() => { delete getLibrary().perks.test_stand_in; });

describe('124 skill groups and functions', () => {
  it('F4: sight and hearing no longer stand in for each other; tremor adds to hearing only', () => {
    const s = makeVillage();
    only(s.player, { [SK.eyesight]: 80 });
    expect(effectiveSkill(s, s.player, SK.earshot).value).toBe(0);
    only(s.player, { [SK.earshot]: 80 });
    expect(effectiveSkill(s, s.player, SK.eyesight).value).toBe(0);
    const slime = s.actors.find((a) => a.core.raceId === RC.slime)!;
    Object.assign(slime.core, { raceId: RC.python, bodyTypeId: BT.serpent }); // AB19: Tremor is for snakes and spiders
    only(slime, { [SK.tremor]: 50 });
    // an augment adds its full value, × tremor's tier 0 (×0.5); it never reaches sight
    expect(effectiveSkill(s, slime, SK.earshot).value).toBe(50 * 0.5);
    expect(effectiveSkill(s, slime, SK.eyesight).value).toBe(0);
  });
  it('F1: a 40 perk in a weapon skill gives +1 to every Melee skill, unarmed included, and not to Ranged', () => {
    const s = makeVillage();
    only(s.player, { [SK.melee_light]: 40, [SK.unarmed_strike]: 10, [SK.slam]: 10, [SK.ranged_light]: 10 });
    give(s.player, PK.keen_edge);
    expect([trueSkill(s.player, SK.melee_light), trueSkill(s.player, SK.unarmed_strike), trueSkill(s.player, SK.ranged_light)]).toEqual([46, 11, 10]);
  });
  it('F4: a perk can move the stand-in share, kept within 0–1', () => {
    const s = makeVillage();
    only(s.player, { [SK.persuasion]: 100 });
    expect(effectiveSkill(s, s.player, SK.barter).value).toBeCloseTo(30);
    getLibrary().perks.test_stand_in = { id: 'test_stand_in', name: 'test', standIn: { add: 0.2, fn: FN.influence } };
    give(s.player, 'test_stand_in');
    expect(effectiveSkill(s, s.player, SK.barter).value).toBeCloseTo(50);
    expect(effectiveSkill(s, s.player, SK.eyesight).value).toBe(0); // another function: unchanged
    getLibrary().perks.test_stand_in.standIn = { add: 5 };
    expect(effectiveSkill(s, s.player, SK.barter).value).toBeCloseTo(100);
  });
});
