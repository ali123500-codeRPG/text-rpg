import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { canTake, canUndo, effectiveSkill, rungState, takePerk, trueSkill, undoPerk } from '../../src/ruleset';
import { getLibrary } from '../../src/library';

// Perk page S1–S9 (Ali, 07/11/2026): true skill and skill ladders.
function setup() {
  const s = makeVillage();
  const L = getLibrary().perks;
  L.t_gb = { id: 't_gb', name: 'Guard Break', ladder: { skill: 'melee_medium', rung: 20 }, effect: 'attack' };
  L.t_wt = { id: 't_wt', name: 'Weapon Training I', ladder: { skill: 'melee_medium', rung: 40 }, trueSkill: 5, effect: 'attack' };
  L.t_60 = { id: 't_60', name: 'Follow-through', ladder: { skill: 'melee_medium', rung: 60 } };
  const p = s.player;
  p.core.skills.melee_medium.raw = 58;
  p.progression!.unspentPerkPoints = 2;
  return { s, p };
}

describe('skill ladders and true skill', () => {
  it('rungs: open when reached, sealed above, empty when no perk is written', () => {
    const { p } = setup();
    expect(rungState(p, 'melee_medium', 20)).toBe('open');
    expect(rungState(p, 'melee_medium', 60)).toBe('sealed');
    expect(rungState(p, 'melee_medium', 80)).toBe('sealed');
    p.core.skills.dodge.raw = 25;
    expect(rungState(p, 'dodge', 20)).toBe('empty');
  });

  it('a flat perk raises true skill, which can open the next rung and feeds effective skill (S3)', () => {
    const { s, p } = setup();
    const before = effectiveSkill(s, p, 'melee_medium').value;
    takePerk(s, p, 't_wt');
    expect(trueSkill(p, 'melee_medium')).toBe(63);
    expect(p.core.skills.melee_medium.raw).toBe(58); // raw untouched (Burden, improvement)
    expect(rungState(p, 'melee_medium', 60)).toBe('open');
    expect(effectiveSkill(s, p, 'melee_medium').value).toBe(before + 5);
  });

  it('taking costs a point (S2); undo refunds it until the next turn (K3)', () => {
    const { s, p } = setup();
    takePerk(s, p, 't_gb');
    expect(p.progression!.unspentPerkPoints).toBe(1);
    expect(rungState(p, 'melee_medium', 20)).toBe('own');
    expect(canUndo(s, p, 't_gb')).toBe(true);
    undoPerk(s, p, 't_gb');
    expect(p.progression!.unspentPerkPoints).toBe(2);
    takePerk(s, p, 't_gb');
    s.turn += 1;
    expect(canUndo(s, p, 't_gb')).toBe(false);
    expect(() => undoPerk(s, p, 't_gb')).toThrow();
  });

  it('refuses without a point or below the rung; keeps a perk if the skill drops (S4)', () => {
    const { s, p } = setup();
    expect(canTake(p, 't_60')).toBe('rung not reached');
    takePerk(s, p, 't_gb'); takePerk(s, p, 't_wt');
    expect(canTake(p, 't_60')).toBe('no perk point');
    p.core.skills.melee_medium.raw = 10;
    expect(rungState(p, 'melee_medium', 20)).toBe('own');
  });
});
