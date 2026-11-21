// 366 Projected aura reach (Tactics tree TC37 a, TC38 b): a projected aura (Battle Cry; Rally later) reaches whoever
// perceives it at any level, or anyone within PROJECTED_AURA_MULT × the owner's aura reach, heard or not. Offensive aura
// was renamed projected aura (TC29). SK31 is shown as Falsehood (TC27 a; its code key is falsehood since BG-321); FN11 is shown as Reaction (TC13 a).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { auraReachM, baseAuraReachM, projectedReachM } from '../../src/engine/auras';
import { SK } from '../../src/library/skillIds';
import { trueSkill } from '../../src/ruleset';
import { PK } from '../../src/library/perkIds';

describe('366 Projected aura reach and Tactics renames', () => {
  it('projected reach is PROJECTED_AURA_MULT times the aura reach, Chorus included', () => {
    const s = makeVillage(), I = SK.intimidation;
    expect(projectedReachM(s.player, I)).toBe(CONFIG.PROJECTED_AURA_MULT * baseAuraReachM(s.player, I));
    s.player.core.perks.push({ perkId: PK.chorus, source: 'level', gainedTurn: 0 });
    expect(projectedReachM(s.player, I)).toBeCloseTo(CONFIG.PROJECTED_AURA_MULT * auraReachM(s.player, I));
    expect(projectedReachM(s.player, I)).toBeGreaterThan(CONFIG.PROJECTED_AURA_MULT * baseAuraReachM(s.player, I));
  });

  // D-193 (RD9): an aura's base reach grows with the square root of its skill, AURA_REACH_M at AURA_REACH_SKILL
  it('base aura reach is AURA_REACH_M × √(aura skill ÷ AURA_REACH_SKILL)', () => {
    const s = makeVillage(), I = SK.intimidation;
    for (const raw of [100, 150, 400]) {
      s.player.core.skills[I] = { raw, state: 'normal' };
      expect(baseAuraReachM(s.player, I)).toBeCloseTo(CONFIG.AURA_REACH_M * Math.sqrt(trueSkill(s.player, I) / CONFIG.AURA_REACH_SKILL));
    }
    s.player.core.skills[I] = { raw: 400, state: 'normal' };
    const far = baseAuraReachM(s.player, I);
    s.player.core.skills[I] = { raw: 100, state: 'normal' };
    expect(far).toBeGreaterThan(baseAuraReachM(s.player, I) * 1.5); // four times the skill reaches about twice as far
  });

});
