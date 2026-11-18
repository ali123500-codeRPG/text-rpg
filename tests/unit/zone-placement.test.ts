// CO1 B, PZ1: code draws every title's footprint in metres from its size and the compass words of its ways.
import { describe, it, expect } from 'vitest';
import { compassOf } from '../../src/scenario/geometry';
import { CONFIG } from '../../src/config';
import type { Zone } from '../../src/types';
import { boxOf, sharedSides } from '../../src/plan/geom';
import { middle, wayTo } from '../../src/plan/where';
import { planWorld, title, way } from '../harness';

const box = (z: Zone) => boxOf(z.outline);
const overlap = (a: Zone, b: Zone) => { const p = box(a), q = box(b); return Math.abs(p.x - q.x) * 2 < p.w + q.w - 0.01 && Math.abs(p.y - q.y) * 2 < p.d + q.d - 0.01; };
const get = (s: { zones: Zone[] }, id: string) => s.zones.find((z) => z.id === id)!;

describe('title placement', () => {
  it('reads compass words as [east, north]', () => {
    expect(compassOf('the north door')).toEqual([0, 1]);
    expect(compassOf('out the west gate')).toEqual([-1, 0]);
    expect(compassOf('the kitchen door')).toBeNull();
  });

  it('area sets the size, the way sets the side, and neighbours touch', () => {
    const s = planWorld([
      title('hall', 'inn', [way('yard', 'the south door', 'door'), way('kitchen', 'the kitchen door', 'door')], { area: 64, roof: true }),
      title('yard', 'inn', [way('hall', 'the hall', 'door')], { area: 400, roof: false }),
      title('kitchen', 'inn', [way('hall', 'the hall', 'door')], { area: 25, roof: true }),
    ]);
    const hall = get(s, 'hall'), yard = get(s, 'yard'), kitchen = get(s, 'kitchen');
    expect(box(hall)).toMatchObject({ x: 0, y: 0, w: 8, d: 8 });
    expect(box(yard).w * box(yard).d).toBeCloseTo(400);
    expect(middle(yard).y).toBeLessThan(middle(hall).y); // south
    expect(sharedSides(hall.outline, yard.outline).length).toBeGreaterThan(0); // they share a wall
    expect(wayTo(s, 'hall', 'yard')?.opening.wall).toBeDefined(); // its door stands in it
    expect(overlap(kitchen, hall) || overlap(kitchen, yard)).toBe(false);
  });

  it('a corridor runs long along the way it is entered', () => {
    const s = planWorld([
      title('room', 'inn', [way('corr', 'the east passage', 'door')], { area: 64, roof: true }),
      title('corr', 'inn', [way('room', 'back', 'door')], { area: 25, aspect: 4, roof: true }),
    ]);
    // whole metres (MAP-10): 25 m² at about 4 to 1 is 8 × 3
    expect(box(get(s, 'corr')).w).toBe(8);
    expect(box(get(s, 'corr')).d).toBe(3);
    expect(middle(get(s, 'corr')).x).toBeGreaterThan(middle(get(s, 'room')).x);
  });

  it('upstairs sits straight above, never across the map', () => {
    const s = planWorld([
      title('hall', 'inn', [way('loft', 'the stairs', 'up')], { area: 64, roof: true }),
      title('loft', 'inn', [way('hall', 'down', 'down')], { area: 25, roof: true }),
    ]);
    const hall = get(s, 'hall'), loft = get(s, 'loft');
    expect(loft.floor).toBe(CONFIG.STOREY_HEIGHT);
    // straight above, within the half metre it takes to put a 5 m loft's walls on whole metres (MAP-10)
    expect(Math.abs(middle(loft).x - middle(hall).x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(middle(loft).y - middle(hall).y)).toBeLessThanOrEqual(0.5);
  });

  it('titles given a footprint keep it, and the next one is drawn against it', () => {
    const s = planWorld([
      title('a', 'inn', [way('b', 'north', 'door')], { rect: { x: 50, y: 50, w: 4, d: 4 }, roof: true }),
      title('b', 'inn', [way('a', 'south', 'door')], { area: 16, roof: true }),
    ]);
    expect(box(get(s, 'a'))).toEqual({ x: 50, y: 50, w: 4, d: 4 });
    expect(box(get(s, 'b'))).toMatchObject({ x: 50, y: 54 });
  });
});
