// Skill groups as ratings (GR1-GR36) and the combat rating's equation (engine/combatLevel.ts, a placeholder): a lone
// skill rates itself, more skills add less, the standard soldier rates its own level, and non-combat shares face an equal foe.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { compoundRating, groupRating, holdStrength, poolOf, ratingOf, strengthFor } from '../../src/ruleset/ratings';
import { clearCombatLevels, combatLevel, combatParts, combatRates, refFighter } from '../../src/engine/combatLevel';
import { nonCombatGroups } from '../../src/engine/nonCombat';
import { itemDef } from '../../src/library';
import { requirement, shortBy } from '../../src/ruleset/requirements';
import { armorStop } from '../../src/library/gearScale';
import { usableModes } from '../../src/ruleset/gear';
import { equipLoadout } from '../../src/library/spawn';
import { GR, RT } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const sheet = (S: GameState, id: string, skills: Record<string, number>, kit: string[] = []): Actor => {
  const a = refFighter(S, 0, id).ref;
  a.core.skills = Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { raw: v, state: 'normal' as const }]));
  a.core.inventory = equipLoadout(S, kit, id);
  return a;
};

describe('group ratings (GR1)', () => {
  it('a lone skill rates itself; two at 50 rate 61; breadth tops out at ×1.41', () => {
    expect(ratingOf(poolOf([80]))).toBeCloseTo(80, 6);
    expect(ratingOf(poolOf([50, 50]))).toBeCloseTo(61.2, 1);
    expect(ratingOf(poolOf(Array(40).fill(50)))).toBeLessThan(50 * Math.SQRT2 + 1e-9);
  });
  it('pools every skill of a group, each once, and a compound row pools its groups (GR35, GR36)', () => {
    const S = makeVillage({ seed: 1 });
    const a = sheet(S, 'x', { [SK.melee_heavy]: 100, [SK.unarmed_strike]: 60, [SK.unarmed_grapple]: 40, [SK.endurance]: 80 });
    expect(groupRating(S, a, GR.melee).rating).toBeCloseTo(ratingOf(poolOf([100, 60, 40])), 6);
    expect(compoundRating(S, a, RT.melee_strength).rating).toBeCloseTo(ratingOf(poolOf([100, 80, 60, 40])), 6);
    expect(strengthFor(S, a, 'break').kind).toBe(RT.melee_strength);
    // GR26: Grapple leaves the pool when strength rides on a Grapple roll
    expect(holdStrength(S, a)).toBeCloseTo(CONFIG.STRENGTH_HOLD_SHARE * ratingOf(poolOf([100, 80, 60])), 6);
  });
  it('the gear portion is the gap between with gear and own (GR8)', () => {
    const S = makeVillage({ seed: 1 });
    const bare = sheet(S, 'b', { [SK.melee_medium]: 60 }), armed = sheet(S, 'c', { [SK.melee_medium]: 60 }, [IT.longsword]);
    const r = groupRating(S, armed, GR.melee);
    expect(r.own).toBeCloseTo(groupRating(S, bare, GR.melee).rating, 6);
    expect(r.gear).toBeCloseTo(r.rating - r.own, 9);
  });
});

describe('combat level equation (placeholder)', () => {
  it('the reference fighter carries relics whose requirement is its level, their stats following (GR40)', () => {
    const S = makeVillage({ seed: 1 });
    const { S: S2, ref } = refFighter(S, 30, 'r');
    const mail = itemDef(S2, ref.core.inventory.find((i) => itemDef(S2, i.itemId).armor)!.itemId);
    expect(requirement(mail)?.need).toBe(30);
    expect(mail.armor!.reduction).toBeCloseTo(armorStop(mail.armor!.weight, 30), 9);
    expect(shortBy(ref, mail)).toBe(0);
  });
  it('its rates come from the tier table and the gap ladder at the pivot, worked by hand', () => {
    const S = makeVillage({ seed: 1 });
    const k = combatRates(S), gap = Object.fromEntries(k.gaps);
    // the level-50 soldier: attack total 35 (skill 50 + kit 20, × 0.5), parry total 25. Attack tiers Near Miss 23 %, Success
    // 25 %, Great Success 42 %, Critical Success 5 % (5 % miss); parry tiers 5, 8, 25, 25, 32, 5 %
    expect([k.attack * 50, k.defense * 50]).toEqual([35, 25]);
    expect(gap[0]).toBeCloseTo(0.23 * 0.25 + 0.25 * 0.25 + 0.42 * 0.32 + 0.05 * 0.05, 9);
    expect(gap[2]).toBeCloseTo(0.23 * 0.32 + 0.25 * 0.05, 9);
    expect(k.gaps.reduce((n, [, p]) => n + p, 0)).toBeCloseTo(0.95, 9);
    // the weights of attack, defense and soak add up to 1, so the soldier comes out at its own level
    expect((k.bA * k.attack + k.bD * k.defense + k.c * k.soakShare) / k.K).toBeCloseTo(1, 9);
    for (const v of [k.bA, k.bD, k.c, k.tierA, k.tierD]) expect(v).toBeGreaterThan(0);
  });
  it('the standard soldier rates its own level at every level, with no ceiling', () => {
    const S = makeVillage({ seed: 1 });
    clearCombatLevels();
    for (const L of [50, 75, 100, 150, 200, 400, 1000]) { const r = refFighter(S, L, 'r' + L); expect(combatLevel(r.S, r.ref)).toBeCloseTo(L, 6); }
    const f = sheet(S, 'f', Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50])), CONFIG.MODEL_REF_KIT); // sword and mail ask for 50
    f.core.standingDefense = 'parry';
    expect(combatLevel(S, f)).toBeCloseTo(50, 6);
  });
  it('every part of a sheet counts: skill, health, nerve, armor, a shield, a harder or faster blow', () => {
    const S = makeVillage({ seed: 1 });
    const base = Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50]));
    const at = (id: string, skills: Record<string, number>, kit: string[] = CONFIG.MODEL_REF_KIT, def: 'parry' | 'block' = 'parry') => { const a = sheet(S, id, skills, kit); a.core.standingDefense = def; return combatLevel(S, a); };
    const std = at('std', base);
    for (const k of [SK.melee_medium, SK.parry, SK.endurance]) expect(at('up' + k, { ...base, [k]: 80 })).toBeGreaterThan(std);
    expect(at('coward', { ...base, [SK.resolve]: 0 })).toBeLessThan(std);
    expect(at('bare', base, [IT.arming_sword])).toBeLessThan(std);
    expect(at('plate', { ...base, [SK.heavy_armor]: 75 }, [IT.arming_sword, IT.plate_harness])).toBeGreaterThan(std * 1.5);
    expect(at('shield', { ...base, [SK.block]: 50 }, [...CONFIG.MODEL_REF_KIT, IT.round_shield], 'block')).toBeGreaterThan(std);
    // a doubling of health is worth the same as a doubling of anything else in the ratio
    const p = combatParts(S, sheet(S, 'parts', base, CONFIG.MODEL_REF_KIT));
    expect(p.perDoubling).toBeCloseTo(Math.LN2 / (combatRates(S).K + 1 / 100), 6);
  });
});

describe('non-combat part (GR34, GR41)', () => {
  it('a share faces an equal foe, so it stays about the same at every level; the pool carries the skill', () => {
    const S = makeVillage({ seed: 1 });
    const at = (v: number) => nonCombatGroups(S, sheet(S, 's' + v, { [SK.sneaking]: v }));
    const [lo, hi] = [at(50)[0], at(200)[0]];
    expect(lo.group).toBe(GR.stealth);
    expect(Math.abs(hi.share - lo.share)).toBeLessThan(0.1);
    expect(hi.adds / lo.adds).toBeCloseTo((hi.pool / lo.pool) * (hi.share / lo.share), 6);
    expect(hi.pool / lo.pool).toBeCloseTo(16, 6); // worth grows as skill²
  });
  it('Heal gives nothing below its unlock, so Medicine adds nothing there', () => {
    const S = makeVillage({ seed: 1 });
    expect(nonCombatGroups(S, sheet(S, 'm', { [SK.healing]: CONFIG.HEAL_UNLOCK - 1 })).find((g) => g.group === GR.medicine)?.adds ?? 0).toBe(0);
    expect(nonCombatGroups(S, sheet(S, 'n', { [SK.healing]: 80 })).find((g) => g.group === GR.medicine)!.adds).toBeGreaterThan(0);
  });
});
