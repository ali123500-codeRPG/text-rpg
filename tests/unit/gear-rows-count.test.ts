// A1: gear rows merge the same item and say how many, in the game's ×N count.
import { describe, expect, it } from 'vitest';
import { gearRows, type GearSnap } from '../../src/agents/game';

const snap = (xs: [string, string, string, number][]): GearSnap => new Map(xs.map(([id, name, where, qty]) => [id, { name, where, qty }]));

describe('gear rows count (A1)', () => {
  it('merges the same item across pieces and stacks, and counts only what changed', () => {
    const a = snap([['b1', 'bandage', 'pack', 3], ['d1', 'dagger', 'held:right hand', 1]]);
    const b = snap([['b1', 'bandage', 'pack', 2], ['ar1', 'arrow', 'pack', 2], ['ar2', 'arrow', 'pack', 1], ['d1', 'dagger', 'pack', 1]]);
    expect(gearRows(a, b)).toEqual(['Used: bandage', 'Picked up: arrow ×3', 'Put away: dagger']);
  });

  it('one of a thing has no count; held keeps its hand', () => {
    const a = snap([['s', 'sword', 'pack', 1], ['r', 'rope', 'pack', 1]]);
    const b = snap([['s', 'sword', 'held:right hand', 1]]);
    expect(gearRows(a, b)).toEqual(['Now held: right hand · sword', 'Gone: rope']);
  });
});
