// BG-313 (PZ12 a): the Map and the minimap draw the floor plan where it lies, only where the fog says the character has seen,
// with each door at its own point on the wall.
import { describe, expect, it } from 'vitest';
import { createFakeGame } from '../../src/ui/fakeGame';
import { knownMap, type MapZone } from '../../src/ui/mapData';
import { MAX_K, planScene, roughMeasure } from '../../src/ui/mapPlan';
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

  it('ground never seen stays dark: no name, no furniture, nothing to point at on the minimap; seen ground is', () => {
    const { s, zones, sc } = fromTheYard();
    const common = zone(zones, 'tavern.common'); // on the trail, but behind the walls from the yard
    expect(common.seen).toEqual([]);
    expect(sc.labels.some((l) => l.zoneId === 'tavern.common')).toBe(false);
    expect(sc.furniture.some((f) => f.zoneId === 'tavern.common')).toBe(false);
    const mid = (id: string) => { const b = boxOf(s.zones.find((z) => z.id === id)!.outline); return { x: b.x, y: b.y }; };
    expect(zoneAt(zones, mid('tavern.common'))).toBeUndefined();
    expect(zoneAt(zones, mid('midden_yard'))?.id).toBe('midden_yard');
    // MAP-20: at the one name size the 5 m yard holds its name zoomed in
    expect(planScene({ zones, every: zones, places: [], k: MAX_K, measure: roughMeasure, awayName: () => undefined }).labels.some((l) => l.zoneId === 'midden_yard')).toBe(true);
  });

});
