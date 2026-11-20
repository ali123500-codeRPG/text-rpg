import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { isEngaged, shortestPath } from '../../src/engine/relations';

describe('foundation', () => {
  it('engagement and paths', () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    expect(isEngaged(s, slime)).toBe(false);
    slime.mind!.knowledge.player = { status: 'suspicious', source: 'seen', revealed: [] };
    expect(isEngaged(s, slime)).toBe(true);
    expect(shortestPath(s, 'tav_common', 'gate_inner')).toEqual(['street_door', 'street_square', 'gate_inner']);
  });
});
