// Title floors (PZ7, PZ14 a): stairs change the floor, never the distance across the map; floors come from the ways' kinds
// (up, down), never from their words. verticalOf still reads words, for the map's stair arrows only.
import { describe, it, expect } from 'vitest';
import { verticalOf, heightOf } from '../../src/scenario/heights';
import { CONFIG } from '../../src/config';
import { planWorld, title, way } from '../harness';

describe('title floors', () => {
  it('reads up and down from exit words (map arrows only)', () => {
    expect(verticalOf('the stairs up')).toBe(1);
    expect(verticalOf('up to the loft')).toBe(1);
    expect(verticalOf('the cellar hatch')).toBe(-1);
    expect(verticalOf('downstairs')).toBe(-1);
    expect(verticalOf('the north gate')).toBe(0);
    expect(verticalOf('the kitchen door')).toBe(0);
  });

  it('a storey up the stairs, down the hatch, level through doors', () => {
    const s = planWorld([
      title('yard', 'inn', [way('hall', 'the front door', 'door')], { roof: false }),
      title('hall', 'inn', [way('yard', 'the front door', 'door'), way('landing', 'the stairs', 'up'), way('cellar', 'the hatch', 'down')], { roof: true }),
      title('landing', 'inn', [way('hall', 'hall', 'down'), way('bedroom', 'a side door', 'door')], { roof: true }),
      title('bedroom', 'inn', [way('landing', 'landing', 'door')], { roof: true }),
      title('cellar', 'inn', [way('hall', 'hall', 'up')], { roof: true }),
    ]);
    const f = (id: string) => heightOf(s.zones.find((z) => z.id === id)!);
    expect(f('yard')).toBe(0);
    expect(f('hall')).toBe(0);
    expect(f('landing')).toBe(CONFIG.STOREY_HEIGHT);
    expect(f('bedroom')).toBe(CONFIG.STOREY_HEIGHT);
    expect(f('cellar')).toBe(-CONFIG.STOREY_HEIGHT);
  });

  it('words never set a floor: a way named "the stairs up" with no kind keeps the floor', () => {
    const s = planWorld([
      title('hall', 'inn', [way('loft', 'the stairs up')], { roof: true }),
      title('loft', 'inn', [way('hall', 'the stairs down')], { roof: true }),
    ]);
    expect(s.zones.map((z) => z.floor)).toEqual([0, 0]);
  });

  it('a floor the plan gave stands, and titles beyond it build on it', () => {
    const s = planWorld([
      title('base', 'tower', [way('top', 'the tower stair', 'up')], { roof: false }),
      title('top', 'tower', [way('base', 'base', 'down'), way('roof', 'the ladder', 'up')], { floor: 20, roof: true }),
      title('roof', 'tower', [way('top', 'top', 'down')], { roof: false }),
    ]);
    const f = (id: string) => s.zones.find((z) => z.id === id)!.floor;
    expect(f('top')).toBe(20);
    expect(f('roof')).toBe(20 + CONFIG.STOREY_HEIGHT);
  });
});
