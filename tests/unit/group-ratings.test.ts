// Skill groups as ratings (GR1-GR36), the expected blow (ruleset/expect.ts) and the combat rating's fight model
// (engine/fightModel.ts, a placeholder): a lone skill rates itself, more skills add less, the expectation matches dice,
// and a fighter in the reference kit fights the reference at its own level evenly.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { compoundRating, groupRating, holdStrength, poolOf, ratingOf, strengthFor } from '../../src/ruleset/ratings';
import { expectBlow } from '../../src/ruleset/expect';
import { combatLevel, duel, refFighter } from '../../src/engine/fightModel';
import { usableModes } from '../../src/ruleset/gear';
import { equipLoadout } from '../../src/library/spawn';
import { GR, RT } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState } from '../../src/types';

const sheet = (S: GameState, id: string, skills: Record<string, number>, kit: string[] = []): Actor => {
  const a = refFighter(S, 0, id);
  delete a.yardstick;
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

describe('the expected blow matches the dice', () => {
  it('a sword on mail: the average health lost over many rolled attacks is the expectation', () => {
    const S = makeVillage({ seed: 1, playerZone: 'field_edge', without: ['guard_1', 'trader', 'patron_1', 'slime_1', 'slime_2'] });
    const A = sheet(S, 'atk', { [SK.melee_medium]: 50 }, [IT.arming_sword]), D = sheet(S, 'def', { [SK.parry]: 50, [SK.medium_armor]: 50, [SK.endurance]: 50 }, [IT.arming_sword, IT.mail_hauberk]);
    D.core.standingDefense = 'parry';
    for (const x of [A, D]) { x.zone = S.player.zone; x.placeId = S.player.placeId; x.pos = S.player.pos && { ...S.player.pos }; S.actors.push(x); }
    const m = usableModes(S, A).find((x) => x.mode.tree === 'melee')!;
    const want = expectBlow(S, A, D, m).body;
    const rng = createRng(7);
    let sum = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) sum += ruleset.attack({ attackerId: A.id, targetId: D.id, weaponId: m.itemId, modeId: m.mode.id, targetPart: null, aimed: false }, S, rng).damage;
    expect(sum / N).toBeGreaterThan(want * 0.9);
    expect(sum / N).toBeLessThan(want * 1.1);
  });
});

describe('fight model (placeholder)', () => {
  it('the reference against itself is even, and a fighter in the reference kit rates its own skill', () => {
    const S = makeVillage({ seed: 1 });
    expect(duel(S, refFighter(S, 80, 'p'), refFighter(S, 80, 'q')).v).toBeCloseTo(1, 6);
    const f = sheet(S, 'f', Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 100])), CONFIG.MODEL_REF_KIT);
    f.core.standingDefense = 'parry';
    expect(combatLevel(S, f)).toBeGreaterThan(97);
    expect(combatLevel(S, f)).toBeLessThan(103);
    const plate = sheet(S, 'g', { ...Object.fromEntries(CONFIG.MODEL_REF_SKILLS.map((k) => [k, 100])), [SK.heavy_armor]: 100 }, [IT.arming_sword, IT.plate_harness]);
    plate.core.standingDefense = 'parry';
    expect(combatLevel(S, plate)).toBeGreaterThan(combatLevel(S, f) * 1.5);
  });
});
