// A sight roll rolls the sight function, not one skill; the higher effective skill applies at full value (its tier
// multiplier still counts). The same goes for hearing. Tremor is no sense function: it augments Earshot, so it adds its
// value to every hearing roll and never to sight.
import { FN } from '../../src/library/functionIds';
import { describe, expect, it } from 'vitest';
import { makeVillage, actor, createRng } from '../harness';
import { ruleset, situational, fnRoller } from '../../src/ruleset';
import { zoneById } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';

const sense = (actorId: string, f: 'sight' | 'hearing') => ({ actorId, skill: f === 'sight' ? SK.eyesight : SK.earshot, fn: FN[f], modifiers: [], tierShifts: [], auto: false as const });
const value = (r: { d100: number; margin: number }) => (r.margin - r.d100 + CONFIG.ROLL_NEEDED) / CONFIG.SKILL_WEIGHT;

describe('sense rolls use the function', () => {
  it('Tremor adds its value to every hearing roll (tier 0 halves it) and nothing to sight', () => {
    const s = makeVillage(), p = actor(s, 'slime_1');
    p.core.skills[SK.tremor] = { raw: 50, state: 'normal' };
    const hearing = ruleset.roll(sense(p.id, 'hearing'), s, createRng(1)), sight = ruleset.roll(sense(p.id, 'sight'), s, createRng(1));
    expect([hearing.skill, value(hearing)]).toEqual([SK.earshot, 25]);
    expect(value(sight)).toBeCloseTo(0);
  });
  it('a slime has no eyes, so Eyesight never counts for it; a human rolls Eyesight and Earshot', () => {
    const s = makeVillage(), slime = actor(s, 'slime_1'), p = s.player;
    slime.core.skills[SK.eyesight] = { raw: 40, state: 'normal' };
    expect(value(ruleset.roll(sense(slime.id, 'sight'), s, createRng(1)))).toBeCloseTo(0);
    p.core.skills[SK.eyesight] = { raw: 40, state: 'normal' };
    p.core.skills[SK.earshot] = { raw: 10, state: 'normal' };
    const sight = ruleset.roll(sense(p.id, 'sight'), s, createRng(1)), hearing = ruleset.roll(sense(p.id, 'hearing'), s, createRng(1));
    expect([sight.skill, value(sight)]).toEqual([SK.eyesight, 40]);
    expect(hearing.skill).toBe(SK.earshot);
  });
  it('light follows the skill that rolls (Q3): a hearing roll ignores the dark, Eyesight does not', () => {
    const s = makeVillage(), slime = actor(s, 'slime_1'), p = s.player;
    slime.core.skills[SK.tremor] = { raw: 50, state: 'normal' };
    p.core.skills[SK.eyesight] = { raw: 40, state: 'normal' };
    const zone = zoneById(s, p.zone)!;
    zone.light = 'dark';
    delete (zone as { outdoor?: true }).outdoor;
    expect(situational(s, fnRoller(s, slime, FN.hearing), { light: zone, actor: slime }).modifiers).toEqual([]);
    expect(fnRoller(s, p, FN.sight)).toBe(SK.eyesight);
    expect(situational(s, fnRoller(s, p, FN.sight), { light: zone, actor: p }).modifiers[0].value).toBeLessThan(0);
  });
});

describe('Curiouser and Curiouser reads the function', () => {
  it('a hearing roll (Earshot, Tremor added) at Success or better counts one tier higher; a melee roll does not', async () => {
    const { afterRollShifts } = await import('../../src/ruleset/allSteps');
    const { TIERS } = await import('../../src/scales');
    const s = makeVillage(), slime = actor(s, 'slime_1');
    slime.core.perks.push({ perkId: PK.curiouser, source: 'mastery', gainedTurn: 0 });
    expect(afterRollShifts(slime, SK.earshot, TIERS.pos('success'))).toEqual([{ source: 'Curiouser and Curiouser', value: 1 }]);
    expect(afterRollShifts(slime, SK.unarmed_natural, TIERS.pos('success'))).toEqual([]);
  });
});
