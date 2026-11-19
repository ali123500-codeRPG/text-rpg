// BG-314 (BF100 b, PZ11 a): a search covers the search area's circle round the searcher in a clear line, whatever title the
// hidden person or thing is in; a title's edge stops nothing, a wall does.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, actor, place, createRng } from '../harness';
import { searchFor, searchItems } from '../../src/minds/state';
import { ruleset } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';

const search = (s: ReturnType<typeof makeVillage>) => {
  const spy = vi.spyOn(ruleset, 'contested');
  searchFor(s, s.player, { kind: 'search', zone: s.player.zone, turn: s.turn } as never, createRng(1));
  const n = spy.mock.calls.length;
  spy.mockRestore();
  return n;
};

describe('405 a search reaches across title edges (BG-314)', () => {
  it('someone hidden 1.6 m off across the open edge between two titles is searched for; so is someone the same distance inside', () => {
    const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'patron_1'] });
    const g = actor(s, 'guard_1');
    s.player.pos = { x: 9, y: -14 };
    place(s, 'guard_1', 'street_square'); g.pos = { x: 11, y: -14 }; g.posture = 'stealthy';
    expect(search(s)).toBe(1);
    place(s, 'guard_1', 'street_door'); g.pos = { x: 7, y: -14 }; g.posture = 'stealthy';
    expect(search(s)).toBe(1);
  });

  it('someone hidden behind a wall at the same distance is not', () => {
    const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'patron_1'] });
    const g = actor(s, 'guard_1');
    s.player.pos = { x: 0, y: -4.8 }; // in the street, the tavern's front wall 0.8 m behind
    place(s, 'guard_1', 'tav_common'); g.pos = { x: 1.5, y: -3.2 }; g.posture = 'stealthy'; // inside, off the doorway's line
    expect(search(s)).toBe(0);
  });

  it('a thing hidden across the edge is searched for too', () => {
    const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'patron_1', 'guard_1'] });
    s.player.pos = { x: 9, y: -14 };
    s.ground.push({ id: 'coin_x', itemId: IT.coin, qty: 1, at: { x: 11, y: -14, floor: 0 }, hiddenAt: { tier: 'success' } } as never);
    expect(searchItems(s, s.player, createRng(1)).r).toBeDefined(); // rolled: it was in reach
  });
});
