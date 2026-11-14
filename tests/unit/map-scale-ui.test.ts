// The Map draws real coordinates (CO9): each place's outline and each World tile is the box around its zones' rectangles
// in metres, so places that adjoin touch along x and y, and a height slider steps through the heights the map has.
import { describe, expect, it } from 'vitest';
import { extentOf, knownMap, worldTiles } from '../../src/ui/mapData';
import { mapHeights } from '../../src/ui/map';
import { createFakeGame } from '../../src/ui/fakeGame';

const edges = (r: { x: number; y: number; w: number; d: number }) => ({ w: r.x - r.w / 2, e: r.x + r.w / 2, s: r.y - r.d / 2, n: r.y + r.d / 2 });

describe('the Map at real coordinates', () => {
  it('whole turn: World tiles take their places’ real extents, which touch where the places adjoin', async () => {
    const g = createFakeGame({ autoStart: true });
    await new Promise((r) => setTimeout(r, 50));
    await g.submit('I look around', { aimed: false });
    const m = knownMap(g.state()!);
    const zones = (root: string) => m.places.filter((p) => p.id === root || p.parentId === root).flatMap((p) => p.zones);
    const w = worldTiles(m);
    const village = w.find((t) => t.id === 'village')!, ash = w.find((t) => t.id === 'ashford')!;
    expect(village.rect).toEqual(extentOf(zones('village')));
    expect(ash.rect).toEqual(extentOf(zones('ashford')));
    // every zone of a place lies inside its extent
    for (const z of zones('village')) {
      const a = edges(z.rect!), b = edges(village.rect!);
      expect(a.w >= b.w - 1e-9 && a.e <= b.e + 1e-9 && a.s >= b.s - 1e-9 && a.n <= b.n + 1e-9).toBe(true);
    }
    // Ashford sits against Millbrook's west side: they share an edge along x, overlapping along y
    const a = edges(ash.rect!), v = edges(village.rect!);
    expect(a.e).toBeCloseTo(v.w, 6);
    expect(Math.min(a.n, v.n) - Math.max(a.s, v.s)).toBeGreaterThan(0);
  });

  it('a place with a zone code has not placed has no extent, so the map keeps the exit diagram for it', () => {
    expect(extentOf([{ rect: { x: 0, y: 0, w: 4, d: 4 } }, {}] as never)).toBeUndefined();
    expect(extentOf([] as never)).toBeUndefined();
  });

  it('the height slider has one stop per height, lowest first', () => {
    expect(mapHeights([{ height: 3 }, { height: 0 }, { height: -3 }, { height: 0 }])).toEqual([-3, 0, 3]);
  });
});
