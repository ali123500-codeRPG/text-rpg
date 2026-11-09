import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { canTake, canUndo, effectiveSkill, milestoneState, takePerk, trueSkill, undoPerk } from '../../src/ruleset';
import { getLibrary } from '../../src/library';

// Perk page S1–S9: true skill and skill ladders.
function setup() {
  const s = makeVillage();
  const L = getLibrary().perks;
  for (const k of Object.keys(L)) delete L[k]; // stand-in perks only, so the real 20 milestone picks don't fill these slots
  L.t_gb = { id: 't_gb', name: 'Guard Break', ladder: { skill: 'melee_medium', milestone: 20 }, effect: 'attack' };
  L.t_wt = { id: 't_wt', name: 'Weapon Training I', ladder: { skill: 'melee_medium', milestone: 40 }, trueSkill: 5, effect: 'attack' };
  L.t_60 = { id: 't_60', name: 'Follow-through', ladder: { skill: 'melee_medium', milestone: 60 } };
  const p = s.player;
  p.core.skills.melee_medium.raw = 58;
  p.progression!.unspentPerkPoints = 2;
  return { s, p };
}

describe('skill ladders and true skill', () => {
  it('milestones: open when reached, sealed above, empty when no perk is written', () => {
    const { p } = setup();
    expect(milestoneState(p, 'melee_medium', 20)).toBe('open');
    expect(milestoneState(p, 'melee_medium', 60)).toBe('sealed');
    expect(milestoneState(p, 'melee_medium', 80)).toBe('sealed');
    p.core.skills.dodge.raw = 25;
    expect(milestoneState(p, 'dodge', 20)).toBe('empty');
  });

  it('a flat perk raises true skill, which can open the next milestone and feeds effective skill (S3)', () => {
    const { s, p } = setup();
    const before = effectiveSkill(s, p, 'melee_medium').value;
    takePerk(s, p, 't_wt');
    expect(trueSkill(p, 'melee_medium')).toBe(63);
    expect(p.core.skills.melee_medium.raw).toBe(58); // raw untouched (Burden, improvement)
    expect(milestoneState(p, 'melee_medium', 60)).toBe('open');
    expect(effectiveSkill(s, p, 'melee_medium').value).toBe(before + 5);
  });

  it('taking costs a point (S2); undo refunds it until the next turn (K3)', () => {
    const { s, p } = setup();
    takePerk(s, p, 't_gb');
    expect(p.progression!.unspentPerkPoints).toBe(1);
    expect(milestoneState(p, 'melee_medium', 20)).toBe('own');
    expect(canUndo(s, p, 't_gb')).toBe(true);
    undoPerk(s, p, 't_gb');
    expect(p.progression!.unspentPerkPoints).toBe(2);
    takePerk(s, p, 't_gb');
    s.turn += 1;
    expect(canUndo(s, p, 't_gb')).toBe(false);
    expect(() => undoPerk(s, p, 't_gb')).toThrow();
  });

  it('refuses without a point or below the milestone; keeps a perk if the skill drops (S4)', () => {
    const { s, p } = setup();
    expect(canTake(p, 't_60')).toBe('milestone not reached');
    takePerk(s, p, 't_gb'); takePerk(s, p, 't_wt');
    expect(canTake(p, 't_60')).toBe('no perk point');
    p.core.skills.melee_medium.raw = 10;
    expect(milestoneState(p, 'melee_medium', 20)).toBe('own');
  });

  it('60 and 80 need one perk in the skill, 100 and 120 need two, 140 needs three', () => {
    const { s, p } = setup();
    p.core.skills.melee_medium.raw = 145;
    p.progression!.unspentPerkPoints = 5;
    expect(milestoneState(p, 'melee_medium', 60)).toBe('sealed');
    expect(canTake(p, 't_60')).toBe('too few perks in this skill');
    takePerk(s, p, 't_gb');
    expect(milestoneState(p, 'melee_medium', 60)).toBe('open');
    expect(milestoneState(p, 'melee_medium', 100)).toBe('sealed');
    takePerk(s, p, 't_wt');
    expect(milestoneState(p, 'melee_medium', 100)).toBe('empty');
    expect(milestoneState(p, 'melee_medium', 140)).toBe('sealed');
    takePerk(s, p, 't_60');
    expect(milestoneState(p, 'melee_medium', 140)).toBe('empty');
  });
});

