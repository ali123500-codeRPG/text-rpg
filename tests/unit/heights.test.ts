// Title floors (PZ7, PZ14 a): stairs change the floor, never the distance across the map; floors come from the ways' kinds
// (up, down), never from their words. verticalOf still reads words, for the map's stair arrows only.
import { describe, it, expect } from 'vitest';
import { heightOf } from '../../src/scenario/heights';
import { CONFIG } from '../../src/config';
import { planWorld, title, way } from '../harness';

describe('title floors', () => {

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

});
