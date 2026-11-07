import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { isEngaged, shortestPath } from '../../src/engine/relations';

describe('foundation', () => {
  it('builds the village fixture', () => {
    const s = makeVillage();
    expect(s.actors.map((a) => a.id)).toEqual(['guard_1', 'trader', 'patron_1', 'slime_1', 'slime_2']);
    expect(s.actors.find((a) => a.id === 'slime_1')!.mind!.routine!.id).toBe('roam_field');
  });
  it('rng is seeded and replayable', () => {
    const a = createRng(7), b = createRng(7);
    expect([a.d100(), a.d100(), a.d100()]).toEqual([b.d100(), b.d100(), b.d100()]);
    const c = createRng(a.state);
    expect(c.d100()).toBe(createRng(a.state).d100());
  });
  it('engagement and paths', () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    expect(isEngaged(s, slime)).toBe(false);
    slime.mind!.knowledge.player = { status: 'suspicious', source: 'seen', revealed: [] };
    expect(isEngaged(s, slime)).toBe(true);
    expect(shortestPath(s, 'tav_common', 'gate_inner')).toEqual(['street_door', 'street_square', 'gate_inner']);
  });
});
