// BG-313 (PZ12 a): the Map and the minimap draw the floor plan where it lies, only where the fog says the character has seen,
// with each door at its own point on the wall.
import { describe, expect, it } from 'vitest';
import { createFakeGame } from '../../src/ui/fakeGame';
import { knownMap, type MapZone } from '../../src/ui/mapData';
import { PX_PER_M, planScene, roughMeasure } from '../../src/ui/mapPlan';
import { zoneAt } from '../../src/ui/minimap';
import { noteZonesSeen } from '../../src/engine/trail';
import { boxOf } from '../../src/plan/geom';

/** the Bent Nail stage, the player in the midden yard, its fog only what it sees from there */
const fromTheYard = () => {
  const s = createFakeGame({ autoStart: true, stage: 'bent-nail' }).state()!;
  s.player.journal!.seenSquares = {};
  s.player.journal!.zonesSeen = [];
  noteZonesSeen(s);
  const zones = knownMap(s).places.flatMap((p) => p.zones).filter((z) => z.height === 0);
  return { s, zones, sc: planScene({ zones, every: zones, places: [], k: 1, measure: roughMeasure, awayName: () => undefined }) };
};
const zone = (zones: MapZone[], id: string) => zones.find((z) => z.id === id)!;

describe('the Map draws the floor plan (BG-313)', () => {
  it('a yard seen over the plank gate draws where it lies on the plan, never moved beside the zone you stand in', () => {
    const { s, zones, sc } = fromTheYard();
    const yard = zone(zones, 'tavern.yard');
    expect(yard.seen!.length).toBeGreaterThan(0); // seen over the gate
    const b = boxOf(s.zones.find((z) => z.id === 'tavern.yard')!.outline), drawn = sc.zones.find((x) => x.z.id === 'tavern.yard')!.box;
    expect(drawn).toMatchObject({ x0: (b.x - b.w / 2) * PX_PER_M, x1: (b.x + b.w / 2) * PX_PER_M, y0: -(b.y + b.d / 2) * PX_PER_M, y1: -(b.y - b.d / 2) * PX_PER_M });
  });

  it('a door draws at its own point on the wall', () => {
    const { s, sc } = fromTheYard();
    expect(sc.doors.length).toBeGreaterThan(0);
    for (const d of sc.doors) {
      const o = s.openings.find((q) => `door:${q.id}` === d.id)!;
      expect(o).toBeDefined();
      expect(d.cx).toBeCloseTo(o.at.x * PX_PER_M);
      expect(d.cy).toBeCloseTo(-o.at.y * PX_PER_M);
    }
  });

  it('ground never seen stays dark: no name, no furniture, nothing to point at on the minimap; seen ground is', () => {
    const { s, zones, sc } = fromTheYard();
    const common = zone(zones, 'tavern.common'); // on the trail, but behind the walls from the yard
    expect(common.seen).toEqual([]);
    expect(sc.labels.some((l) => l.zoneId === 'tavern.common')).toBe(false);
    expect(sc.furniture.some((f) => f.zoneId === 'tavern.common')).toBe(false);
    const mid = (id: string) => { const b = boxOf(s.zones.find((z) => z.id === id)!.outline); return { x: b.x, y: b.y }; };
    expect(zoneAt(zones, mid('tavern.common'))).toBeUndefined();
    expect(zoneAt(zones, mid('midden_yard'))?.id).toBe('midden_yard');
    expect(sc.labels.some((l) => l.zoneId === 'midden_yard')).toBe(true);
  });

  it('MAP-33: seen ground is in sight now or faded square by square, and what the latest look sees alone is in sight', () => {
    const { s, zones } = fromTheYard();
    const area = (rs: { x0: number; x1: number; y0: number; y1: number }[] = []) => rs.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
    const yard = zone(zones, 'midden_yard');
    expect(area(yard.sight)).toBeGreaterThan(0); // where you stand is in sight
    expect(area(yard.sight)).toBeLessThanOrEqual(area(yard.seen));
    s.player.zone = 'tavern.yard'; s.player.pos = { ...boxOf(s.zones.find((z) => z.id === 'tavern.yard')!.outline) };
    noteZonesSeen(s);
    const after = knownMap(s).places.flatMap((p) => p.zones), lane = zone(after, 'high_lane');
    expect(area(lane.seen)).toBeGreaterThan(0); // still remembered
    expect(area(lane.sight)).toBeLessThan(area(lane.seen)); // but not all of it in sight from behind the plank gate
  });

});
