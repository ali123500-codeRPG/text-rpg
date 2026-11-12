// CO1 B: code places every zone as a rectangle in metres from its size and the compass words of its exits.
import { describe, it, expect } from 'vitest';
import { compassOf, doorway, placeZones, zoneDistanceM } from '../../src/scenario/geometry';
import { CONFIG } from '../../src/config';
import type { GameState, Zone } from '../../src/types';

const zone = (id: string, links: [string, string][], extra: Partial<Zone> = {}): Zone =>
  ({ id, placeId: 'inn', name: id, look: '', links: links.map(([to, label]) => ({ to, label, sight: false })), cover: 'none', light: 'dim', groundItems: [], ...extra });
const world = (zones: Zone[]) => ({ places: [{ id: 'inn', zones }] }) as unknown as GameState;
const overlap = (a: Zone, b: Zone) => Math.abs(a.rect!.x - b.rect!.x) * 2 < a.rect!.w + b.rect!.w - 0.01 && Math.abs(a.rect!.y - b.rect!.y) * 2 < a.rect!.d + b.rect!.d - 0.01;

describe('zone placement', () => {
  it('reads compass words as [east, north]', () => {
    expect(compassOf('the north door')).toEqual([0, 1]);
    expect(compassOf('out the west gate')).toEqual([-1, 0]);
    expect(compassOf('the kitchen door')).toBeNull();
  });

  it('area sets the size, the exit sets the side, and neighbours touch', () => {
    const hall = zone('hall', [['yard', 'the south door'], ['kitchen', 'the kitchen door']], { area: 64 });
    const yard = zone('yard', [['hall', 'the hall']], { area: 400, outdoor: true });
    const kitchen = zone('kitchen', [['hall', 'the hall']], { area: 25 });
    const zs = [hall, yard, kitchen];
    placeZones(world(zs), zs);
    expect(hall.rect).toMatchObject({ x: 0, y: 0, w: 8, d: 8 });
    expect(yard.rect!.w * yard.rect!.d).toBeCloseTo(400);
    expect(yard.rect!.y).toBeLessThan(hall.rect!.y); // south
    expect(doorway(hall, yard)).not.toBeNull(); // they share a wall
    expect(overlap(kitchen, hall) || overlap(kitchen, yard)).toBe(false);
    expect(zoneDistanceM(hall, kitchen)).toBeGreaterThan(0);
  });

  it('a corridor runs long along the way it is entered', () => {
    const room = zone('room', [['corr', 'the east passage']], { area: 64 });
    const corr = zone('corr', [['room', 'back']], { area: 25, aspect: 4 });
    placeZones(world([room, corr]), [room, corr]);
    expect(corr.rect!.w).toBeCloseTo(10);
    expect(corr.rect!.d).toBeCloseTo(2.5);
    expect(corr.rect!.x).toBeGreaterThan(room.rect!.x);
  });

  it('upstairs sits straight above, never across the map', () => {
    const hall = zone('hall', [['loft', 'the stairs up']], { area: 64 });
    const loft = zone('loft', [['hall', 'down']], { area: 25, height: CONFIG.STOREY_HEIGHT });
    placeZones(world([hall, loft]), [hall, loft]);
    expect([loft.rect!.x, loft.rect!.y]).toEqual([hall.rect!.x, hall.rect!.y]);
  });

  it('zones already placed keep their rectangles', () => {
    const a = zone('a', [['b', 'north']], { rect: { x: 50, y: 50, w: 4, d: 4 } });
    const b = zone('b', [['a', 'south']], { area: 16 });
    placeZones(world([a, b]), [b]);
    expect(a.rect).toEqual({ x: 50, y: 50, w: 4, d: 4 });
    expect(b.rect).toMatchObject({ x: 50, y: 54 });
  });
});
