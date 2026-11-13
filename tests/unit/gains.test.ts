import { describe, expect, it } from 'vitest';
import { anyGains, gainsSummary } from '../../src/ui/gains';
import type { ScenarioGains } from '../../src/types';

const none: ScenarioGains = { skills: [], perks: [], allPerks: [], achievements: [], xp: { gained: 0, fromLevel: 3, fromPct: 40, toLevel: 3, toPct: 40 }, levelUps: [] };

describe('scenario-end gains panel (M-39)', () => {
  it('opens only for a scenario that gave something', () => {
    expect(anyGains(undefined)).toBe(false);
    expect(anyGains(none)).toBe(false);
    expect(anyGains({ ...none, xp: { ...none.xp, gained: 5 } })).toBe(true);
    expect(anyGains({ ...none, perks: [{ skill: 'SK12', milestone: 20 }] })).toBe(true);
    expect(anyGains({ ...none, essences: [{ name: 'Gel Patience', grade: 'fine' }] })).toBe(true); // an offer alone is worth the moment
  });
  it('sums the gains in one line for the story and screen readers', () => {
    const g: ScenarioGains = { ...none,
      skills: [{ skill: 'SK2', from: 40, to: 43 }, { skill: 'SK12', from: 18, to: 22 }],
      allPerks: [{ tree: 'TR1', step: 50, name: 'All-50: Melee' }],
      achievements: [{ id: 'a', name: 'Untouched' }, { id: 'b', name: 'First Crack', scar: true }],
      xp: { gained: 180, fromLevel: 3, fromPct: 60, toLevel: 4, toPct: 30 }, levelUps: [{ classId: 'CL1', level: 4 }] };
    expect(gainsSummary(g)).toBe('2 skills up · All-50: Melee · 1 achievement · 1 scar · +180 XP · level 4');
  });
  it('writes fractional XP to one decimal, the same way the count does', () => {
    expect(gainsSummary({ ...none, xp: { ...none.xp, gained: 247.83333 } })).toBe('+247.8 XP');
  });
  it('names essences on offer', () => {
    expect(gainsSummary({ ...none, essences: [{ name: 'Gel Patience', grade: 'fine' }] })).toBe('1 essence offered');
  });
});
