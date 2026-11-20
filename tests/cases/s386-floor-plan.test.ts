// 386 Phase out zones (PZ1-PZ17): a zone is only a title, the name of a space; walls, openings, light, clutter, walking
// paths and what lies on the ground live on the floor plan or at a point. Two rooms side by side with a wall between them
// and one way through it are enough to show each rule.
import { describe, expect, it } from 'vitest';
import type { GameState, WayKind } from '../../src/types';
import { planWorld, title, way } from '../harness/plan';
import { makeVillage, lay } from '../harness';
import { ZK } from '../../src/library/tableIds';
import { ACH } from '../../src/library/achievementIds';
import { CONFIG } from '../../src/config';
import { lineClear } from '../../src/plan/line';
import { walkPath } from '../../src/plan/path';
import { luxAt, zoneLight } from '../../src/plan/light';
import { keepInside, rectOutline } from '../../src/plan/geom';
import { soundDb } from '../../src/perception/noise';
import { groundIn } from '../../src/engine/ground';
import { turnFeats } from '../../src/engine/feats';
import { placeZones } from '../../src/scenario/geometry';

const EYE = 1.6;
/** room a (x -5..5) and room b (x 5..15), both 10 m square under a roof, joined on their shared wall by one way */
const rooms = (kind: WayKind, lightA: 'bright' | 'black' = 'bright', lightB: 'bright' | 'black' = 'black'): GameState => planWorld([
  title('a', 'house', [way('b', 'the east way', kind)], { kind: ZK.room, rect: { x: 0, y: 0, w: 10, d: 10 }, roof: true, light: lightA }),
  title('b', 'house', [way('a', 'the west way', kind)], { kind: ZK.room, rect: { x: 10, y: 0, w: 10, d: 10 }, roof: true, light: lightB }),
]);

describe('386 titles on a floor plan (PZ1-PZ17)', () => {

  it('PZ3: a wall stops sight; a gap is seen through only within its span, a plain doorway not at all', () => {
    const gap = rooms('open'), door = rooms('door');
    const A = { x: -3, y: 0, z: EYE }, B = { x: 13, y: 0, z: EYE }, offGap = { x: 13, y: 4, z: EYE };
    expect(lineClear(gap, A, B)).toBe(true); // straight through the gap at the wall's middle
    expect(lineClear(gap, { x: -3, y: 4, z: EYE }, offGap)).toBe(false); // through the wall beside it
    expect(lineClear(door, A, B)).toBe(false);
  });

  it('PZ3: a line through an exact corner of the walls\' look-up grid still meets the wall (no endless walk of the grid)', () => {
    const s = planWorld([title('box', 'house', [], { kind: ZK.room, rect: { x: 16, y: 12, w: 8, d: 16 }, roof: true })]); // west wall x 12, y 4..20
    expect(lineClear(s, { x: 0, y: 0, z: EYE }, { x: 24, y: 24, z: EYE })).toBe(false); // crosses the grid's corners at (8, 8) and (16, 16)
    expect(lineClear(s, { x: 0, y: 0, z: EYE }, { x: 8, y: 8, z: EYE })).toBe(true);
  });

  it('PZ8: a walk goes round the wall through the way, never through the wall', () => {
    const s = rooms('door');
    const w = walkPath(s, { x: -3, y: 4, floor: 0 }, { x: 13, y: 4, floor: 0 })!;
    expect(w.through.map((o) => o.id)).toEqual([s.openings[0].id]);
    expect(w.pts.some((p) => Math.abs(p.x - 5) < 0.6 && Math.abs(p.y) <= 1)).toBe(true); // through the doorway at the wall's middle
    expect(w.metres).toBeGreaterThan(16); // longer than the straight line through the wall
  });

  it('PZ4: a sound loses more through a shut door than through an open gap', () => {
    const at = (s: GameState) => soundDb(s, 'normal', { zone: 'a', pos: { x: -3, y: 0 } }, { zone: 'b', pos: { x: 13, y: 0 } })!;
    expect(at(rooms('door'))).toBeLessThan(at(rooms('open')));
  });

  it('PZ5: light falls off from its source; a title\'s light with no point is its dimmest; no line, no light', () => {
    const s = rooms('door');
    expect(luxAt(s, { x: 0, y: 0 }, 0)).toBeGreaterThan(luxAt(s, { x: 4.5, y: 4.5 }, 0)); // by the lamp, then its far corner
    expect(zoneLight(s, s.zones.find((z) => z.id === 'a'))).toBe('bright'); // the word holds out to its far corner
    expect(zoneLight(s, s.zones.find((z) => z.id === 'b'))).toBe('black'); // a shut doorway lets none of a's light through
    s.clocks = { ...(s.clocks ?? {}), time: 12 * 60 } as GameState['clocks'];
    expect(zoneLight(s, s.zones.find((z) => z.id === 'b'))).toBe('black'); // under a roof, the midday sky lights nothing
  });

  it('PZ11: what lies on the ground lies at a point; its title is the title of that point', () => {
    const s = rooms('door') as GameState;
    lay(s, 'b', { id: 'cup', itemId: 'IT1' }, { x: 12, y: 2 });
    expect(groundIn(s, 'b').map((i) => i.id)).toEqual(['cup']);
    expect(groundIn(s, 'a')).toEqual([]);
    expect(s.ground[0].at).toEqual({ x: 12, y: 2, floor: 0 });
  });

  it('a point asked for past a corner is kept a step in from both walls', () => {
    const r = rectOutline({ x: 0, y: 0, w: 8, d: 8 });
    expect(keepInside({ x: 30, y: 30 }, r, 1.25)).toEqual({ x: 2.75, y: 2.75 });
    expect(keepInside({ x: 30, y: 1 }, r, 1.25)).toEqual({ x: 2.75, y: 1 });
    expect(keepInside({ x: 1, y: 1 }, r, 1.25)).toEqual({ x: 1, y: 1 });
  });

  it('placement: a title joined to two placed titles touches both where it can (no long connector on the Map)', () => {
    const s = planWorld([
      title('lane', 'town', [way('back', 'over the wall', 'door')], { kind: ZK.street, rect: { x: 0, y: -15, w: 10, d: 30 }, roof: false }),
      title('back', 'town', [way('lane', 'over the wall', 'door')], { kind: ZK.yard, rect: { x: 15, y: 5, w: 20, d: 10 }, roof: false }),
    ]);
    const yard = { id: 'yard', placeId: 'town', name: 'yard', look: '', outline: [], floor: 0, top: CONFIG.OPEN_AIR_TOP_M } as unknown as GameState['zones'][number];
    s.places[0].zones.push(yard); s.zones.push(yard);
    placeZones(s, [{ z: yard, area: 25, aspect: 1, roof: false }], [{ a: 'yard', b: 'back', label: 'the gate', vertical: 0 }, { a: 'yard', b: 'lane', label: 'the gap', vertical: 0 }], () => false);
    const xs = yard.outline.map((p) => p.x), ys = yard.outline.map((p) => p.y);
    expect(Math.min(...xs)).toBe(5); // against the lane's east side
    expect(Math.max(...ys)).toBe(0); // against the back yard's south side
  });

  it('PZ17 a: each 100 m land cell the player stands in counts once for the new-ground chain', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const ids = () => (s.player.progression!.achievements ?? []).map((a) => a.id);
    turnFeats(s, []);
    turnFeats(s, []);
    expect(s.player.progression!.cellsStood).toHaveLength(1);
    expect(ids()).toContain(ACH.ground_1);
    s.player.pos = { x: s.player.pos!.x + CONFIG.REGION_CELL_M, y: s.player.pos!.y };
    turnFeats(s, []);
    expect(s.player.progression!.cellsStood).toHaveLength(2);
    expect(ids()).not.toContain(ACH.ground_25);
  });
});
