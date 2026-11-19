// Skill groups as ratings (GR1-GR36) and the combat rating's equation (engine/combatLevel.ts, a placeholder): a lone
// skill rates itself, more skills add less, the standard soldier rates its own level, and non-combat shares face an equal foe.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { hitTable, ladder } from '../../src/ruleset';
import { compoundRating, groupRating, holdStrength, poolOf, ratingOf, strengthFor } from '../../src/ruleset/ratings';
import { clearCombatLevels, combatLevel, combatParts, fightAt, refFighter } from '../../src/engine/combatLevel';
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
  it('the average blow is the exact sum over both rolls and the hit table, worked by hand', () => {
    const S = makeVillage({ seed: 1 });
    const base = Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50]));
    const of = (id: string, kit: string[]) => { const a = sheet(S, id, base, kit); a.core.standingDefense = 'parry'; return a; };
    const bare = of('bare', [IT.arming_sword]), mailed = of('mailed', CONFIG.MODEL_REF_KIT);
    // the level-50 soldier's blow: attack total 35 (skill 50 + kit 20, × 0.5) on a parry total of 25. Attack tiers Near Miss
    // 23 %, Success 25 %, Great Success 42 %, Critical Success 5 % (5 % never land); parry tiers 5, 8, 25, 25, 32, 5 %
    const atk = [[2, 0.23], [3, 0.25], [4, 0.42], [5, 0.05]], par = [[0, 0.05], [1, 0.08], [2, 0.25], [3, 0.25], [4, 0.32], [5, 0.05]];
    const sword = 25 * (1 + CONFIG.DAMAGE_NEED_RATE * 50); // a Fine sword: requirement 50
    const blow = (share: number, soak: number) => atk.reduce((n, [la, pa]) => n + par.reduce((m, [ld, pd]) => m + pa * pd * Math.max(0, ladder('parry', ld - la) * sword * share - soak), 0), 0);
    const mail = itemDef(S, IT.mail_hauberk).armor!;
    const covered = hitTable(S, mailed).reduce((n, r) => n + (mail.covers.includes(r.part) ? (r.to - r.from + 1) / 100 : 0), 0);
    const [open, shut] = [fightAt(S, bare, 50), fightAt(S, mailed, 50)];
    // same health and nerve, so the seconds the soldier needs go as one over its average blow
    expect(shut.its / open.its).toBeCloseTo(blow(1, 0) / (covered * blow(mail.multiplier, mail.reduction) + (1 - covered) * blow(1, 0)), 9);
    // the mailed sheet is the level-50 soldier: both sides need the same time, at 4 s a blow
    expect(shut.mine).toBeCloseTo(shut.its, 9);
    expect(shut.lead).toBeCloseTo(0, 9);
    expect(shut.attack!.secs).toBe(4);
  });
  it('the standard soldier rates its own level at every level, with no ceiling and no lever', () => {
    const S = makeVillage({ seed: 1 });
    clearCombatLevels();
    for (const L of [0, 25, 50, 75, 100, 150, 200, 400, 1000]) { const r = refFighter(S, L, 'r' + L); expect(combatLevel(r.S, r.ref)).toBeCloseTo(L, 6); }
    const f = sheet(S, 'f', Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50])), CONFIG.MODEL_REF_KIT); // sword and mail ask for 50
    f.core.standingDefense = 'parry';
    expect(combatLevel(S, f)).toBeCloseTo(50, 6);
    // between two whole levels: ahead of the lower soldier, behind the upper one
    const g = sheet(S, 'g', { ...Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50])), [SK.melee_medium]: 60 }, CONFIG.MODEL_REF_KIT);
    g.core.standingDefense = 'parry';
    const p = combatParts(S, g);
    expect(p.level).toBeGreaterThan(p.below);
    expect(p.level).toBeLessThan(p.below + 1);
    expect(fightAt(S, g, p.below).lead).toBeLessThanOrEqual(0);
    expect(fightAt(S, g, p.below + 1).lead).toBeGreaterThan(0);
  });
  it('every part of a sheet counts: skill, health, nerve, armor, a shield, a weapon that asks for more', () => {
    const S = makeVillage({ seed: 1 });
    const base = Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50]));
    const at = (id: string, skills: Record<string, number>, kit: string[] = CONFIG.MODEL_REF_KIT, def: 'parry' | 'block' = 'parry') => { const a = sheet(S, id, skills, kit); a.core.standingDefense = def; return combatLevel(S, a); };
    const std = at('std', base);
    for (const k of [SK.melee_medium, SK.parry, SK.endurance]) expect(at('up' + k, { ...base, [k]: 80 })).toBeGreaterThan(std);
    expect(at('coward', { ...base, [SK.resolve]: 0 })).toBeLessThan(std);
    expect(at('bare', base, [IT.arming_sword])).toBeLessThan(std);
    expect(at('plate', { ...base, [SK.heavy_armor]: 75 }, [IT.arming_sword, IT.plate_harness])).toBeGreaterThan(std + 20);
    expect(at('shield', { ...base, [SK.block]: 50 }, [...CONFIG.MODEL_REF_KIT, IT.round_shield], 'block')).toBeGreaterThan(std);
    // the level-100 soldier's sword in the same hands: its damage grows with its requirement (and its kit bonus with it)
    const { S: S2, ref } = refFighter(S, 100, 'relic');
    const keen = sheet(S2, 'keen', { ...base, [SK.melee_medium]: 100 }, CONFIG.MODEL_REF_KIT);
    keen.core.inventory = [...keen.core.inventory.filter((i) => !itemDef(S2, i.itemId).weapon), ...ref.core.inventory.filter((i) => itemDef(S2, i.itemId).weapon).map((i) => ({ ...i, id: 'keen_sword' }))];
    const plain = sheet(S2, 'plain', { ...base, [SK.melee_medium]: 100 }, CONFIG.MODEL_REF_KIT);
    for (const a of [keen, plain]) a.core.standingDefense = 'parry';
    expect(combatLevel(S2, keen)).toBeGreaterThan(combatLevel(S2, plain));
  });
  it('a broken shield blocks nothing: a blocker is read with the defense it falls back on once the pool is gone', () => {
    const S = makeVillage({ seed: 1 });
    const base = { ...Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 50])), [SK.block]: 50 };
    const at = (id: string, parry: number) => { const a = sheet(S, id, { ...base, [SK.parry]: parry }, [...CONFIG.MODEL_REF_KIT, IT.round_shield]); a.core.standingDefense = 'block'; return combatLevel(S, a); };
    expect(at('fallback80', 80)).toBeGreaterThan(at('fallback50', 50));
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
