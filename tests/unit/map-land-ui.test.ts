// The World map draws the land the character has seen (WZ4) under its places and roads, and a road bound to a region's
// road line (WZ1) runs along that line, with your pin at your point along it.
import { describe, expect, it } from 'vitest';
import { alongLine, knownMap, pointAlong, worldTiles } from '../../src/ui/mapData';
import { landLabels, landLayer } from '../../src/ui/landSvg';
import { createFakeGame } from '../../src/ui/fakeGame';

describe('the land on the World map', () => {
  it('whole turn: the land drawn is only the cells seen, and on the mill road your pin sits on its line', async () => {
    const g = createFakeGame({ autoStart: true });
    await new Promise((r) => setTimeout(r, 50));
    await g.submit('travel mill', { aimed: false });
    const s = g.state()!, m = knownMap(s);
    const land = m.land![0], r = land.region, N = r.size / r.cell;
    expect(land.key).toBe(`${r.id}:${s.player.journal!.landSeen![r.id]}`); // the cache key changes with the cells seen

    // every point of the land's markup lies on or next to a cell seen (the shapes are smoothed by up to a cell)
    const svg = landLayer(r, land);
    const pts = [...svg.matchAll(/(?:d|points)="([^"]+)"/g)].flatMap((x) => [...x[1].matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((q) => ({ x: +q[1], y: -q[2] })));
    expect(pts.length).toBeGreaterThan(100);
    const near = (p: { x: number; y: number }) => {
      const c = Math.floor(p.x / r.cell), row = Math.floor(p.y / r.cell);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const cc = c + dc, rr = row + dr;
        if (cc >= 0 && rr >= 0 && cc < N && rr < N && land.seen(rr * N + cc)) return true;
      }
      return false;
    };
    expect(pts.filter((p) => !near(p))).toEqual([]);
    // nothing seen, no land; a site far from what was seen is not named
    expect(landLayer(r, { seen: () => false })).not.toMatch(/class="lc |<polyline/);
    const cellOf = (p: { x: number; y: number }) => Math.floor(p.y / r.cell) * N + Math.floor(p.x / r.cell);
    expect(landLabels(r, land).every((l) => land.seen(cellOf(l.at)))).toBe(true);

    // the mill road: its zone and its World tile carry the road line, and your pin is the point along it
    const road = m.places.find((p) => p.id === 'mill_road')!.zones[0], line = r.roads.find((x) => x.id === s.places.find((p) => p.id === 'mill_road')!.zones[0].road)!;
    expect(road.line).toEqual(line.pts);
    expect(worldTiles(m).find((t) => t.id === 'mill_road')!.line).toEqual(line.pts);
    expect(road.along!.m).toBeCloseTo(line.length * 0.45, 0);
    expect(road.along!.len).toBeCloseTo(line.length, 0);
    const pin = pointAlong(road.line!, road.along!.m);
    expect(pin.x).toBeCloseTo(s.player.pos!.x, 3);
    expect(pin.y).toBeCloseTo(s.player.pos!.y, 3);
  });

  it('a point along a line: metres from its first point, that end named by its compass side', () => {
    const line = [{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 400, y: 300 }]; // north, then east
    expect(alongLine(line, { x: 10, y: 100 })).toEqual({ m: 100, len: 700, from: 'west', to: 'east' });
    expect(alongLine(line, { x: 200, y: 320 })).toMatchObject({ m: 500 });
    expect(pointAlong(line, 500)).toEqual({ x: 200, y: 300 });
    expect(pointAlong(line, 9999)).toEqual({ x: 400, y: 300 });
    expect(alongLine([...line].reverse(), { x: 400, y: 300 })).toMatchObject({ m: 0, from: 'east', to: 'west' });
  });
});
