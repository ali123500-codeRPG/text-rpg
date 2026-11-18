// CO15/CO16, PZ2: titles get an area in m² and a wall kind per side, from the kind unless the Weaver names others.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { LY, WK, ZK } from '../../src/library/tableIds';
import { roadShape } from '../../src/scenario/apply';
import { getLibrary } from '../../src/library';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import type { GameState, StagePlan, Zone } from '../../src/types';
import { boxOf, sidesOf } from '../../src/plan/geom';
import { wallAt } from '../../src/plan/walls';
import { middle, wayTo } from '../../src/plan/where';

/** the wall kind standing on each compass side of a rectangular title (WK.open where none stands) */
function sides(s: GameState, z: Zone): Record<string, string> {
  const b = boxOf(z.outline), out: Record<string, string> = {};
  for (const [a, c] of sidesOf(z.outline)) {
    const m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
    const k = Math.abs(m.y - (b.y + b.d / 2)) < 0.01 ? 'n' : Math.abs(m.y - (b.y - b.d / 2)) < 0.01 ? 's' : Math.abs(m.x - (b.x + b.w / 2)) < 0.01 ? 'e' : 'w';
    out[k] = wallAt(s, m, z.floor)?.kind ?? WK.open;
  }
  return out;
}

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const zoneOf = (s: ReturnType<typeof makeVillage>, key: string) => s.places.flatMap((p) => p.zones).find((z) => z.id.endsWith(key) || z.name === key);

describe('title sizes and walls', () => {
  it('every size and wall kind has a library row; sizes grow smallest first', () => {
    const lib = getLibrary();
    const m2 = Object.values(lib.zoneSizes!).map((z) => z.m2);
    expect(m2).toEqual([...m2].sort((a, b) => a - b));
    expect(Object.values(lib.zoneSizes!).every((z) => z.like.length > 0)).toBe(true);
    for (const k of Object.values(lib.zoneKinds!)) { expect(CONFIG.ZONE_SIZE_M2[k.size]).toBeGreaterThan(0); expect(lib.wallKinds![k.wall]).toBeDefined(); }
  });

  it('a title takes its kind\'s size and walls; the Weaver can change one side or give m²', () => {
    const s = toStoryStart(makeVillage());
    const plan: StagePlan = villageStagePlan();
    const [first, second] = plan.zones;
    first.walls = { n: WK.low };
    second.area = 140;
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const a = zoneOf(s, first.name)!, b = zoneOf(s, second.name)!;
    const kind = getLibrary().zoneKinds![first.kind!];
    expect(a.area).toBe(CONFIG.ZONE_SIZE_M2[kind.size]);
    expect(sides(s, a).n).toBe(WK.low);
    for (const k of ['e', 's', 'w']) if (!s.openings.some((o) => o.joins.includes(a.id) && o.wall && wallAt(s, o.at, a.floor)?.id === o.wall)) expect([kind.wall, WK.wall]).toContain(sides(s, a)[k]);
    expect(b.area).toBe(140);
  });

  it('an unknown size or wall kind fails validation (and so is filed as a bug)', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones[0].size = 'huge';
    plan.zones[1].walls = { n: 'WK99' };
    expect(validateStagePlan(s, plan, ctx).filter((e) => e.code === 'bad_zone')).toHaveLength(2);
  });
});

describe('layouts (CO17)', () => {
  it('a place that names a layout gets its titles, keyed placeKey.zoneKey, sized, walled and placed; they skip the zone cap', () => {
    const s = toStoryStart(makeVillage());
    CONFIG.PLAN_CAPS = { ...CONFIG.PLAN_CAPS, places: 5 }; // the fixture plan already uses 4 places
    const plan = villageStagePlan();
    plan.places.push({ key: 'smithy', name: 'Hob\'s Smithy', kind: 'place', parent: 'village', layout: LY.smithy, names: { forge: 'Hob\'s forge' } });
    plan.zones.find((z) => z.key === 'street_door')!.ways.push({ to: 'smithy.forge', label: 'the smithy, east' });
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    expect(plan.zones.filter((z) => z.fromLayout)).toHaveLength(getLibrary().layouts![LY.smithy].zones.length);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const forge = zoneOf(s, 'Hob\'s forge')!, coal = zoneOf(s, 'coal store')!;
    expect(sides(s, forge).s).toBe(WK.open);
    expect(forge.outline.length && coal.outline.length).toBeTruthy();
    expect(middle(coal).x).toBeGreaterThan(middle(forge).x); // "the coal store, east"
    expect(wayTo(s, forge.id, zoneOf(s, 'outside the tavern')!.id)).toBeDefined(); // the way runs both ways
  });

  it('an unknown layout fails validation', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.places.push({ key: 'x', name: 'X', kind: 'place', parent: 'village', layout: 'LY99' });
    expect(validateStagePlan(s, plan, ctx).some((e) => e.code === 'bad_place')).toBe(true);
  });

  it('every layout is well formed: kinds, sizes, walls and ways resolve, and the entry exists', () => {
    const lib = getLibrary();
    for (const l of Object.values(lib.layouts!)) {
      const keys = new Set(l.zones.map((z) => z.key));
      expect(keys.has(l.entry)).toBe(true);
      for (const z of l.zones) {
        expect(lib.zoneKinds![z.kind]).toBeDefined();
        if (z.size) expect(CONFIG.ZONE_SIZE_M2[z.size]).toBeGreaterThan(0);
        for (const wk of Object.values(z.walls ?? {})) expect(lib.wallKinds![wk!]).toBeDefined();
        for (const [to] of z.ways) expect(keys.has(to)).toBe(true);
      }
    }
  });
});

describe('roads (TV3, TV4)', () => {
  it('a road is one long title with no kind: its length word or km sets its line and band, ROAD_WIDTH_M wide, with its danger', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones.push({ key: 'north_road', place: plan.zones.find((z) => z.key === 'street_door')!.place, name: 'the north road', look: 'a rutted cart track',
      length: 'day', danger: 'wild', ways: [{ to: 'street_door', label: 'back to the village, south' }, { to: 'far_north', label: 'on north' }] });
    plan.frontiers.push({ key: 'far_north', label: 'on north' });
    plan.zones.find((z) => z.key === 'street_door')!.ways.push({ to: 'north_road', label: 'the north road' });
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const road = zoneOf(s, 'the north road')!;
    expect(road.danger).toBe('wild');
    const r = boxOf(road.outline);
    expect(road.line).toHaveLength(2);
    expect(Math.max(r.w, r.d)).toBeCloseTo(30000);
    expect(Math.min(r.w, r.d)).toBeCloseTo(CONFIG.ROAD_WIDTH_M);
    expect(r.y).toBeGreaterThan(middle(zoneOf(s, plan.zones.find((z) => z.key === 'street_door')!.name)!).y); // north of the street
  });

  it('only a road takes a length or danger (dropped elsewhere, BG-141); a bad word on a road fails validation', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones[0].length = 'hour';
    plan.zones[1].danger = 'wild';
    plan.zones.push({ key: 'r', place: plan.zones[0].place, name: 'a road', look: 'a road', length: 'forever', danger: 'deadly', ways: [] });
    const errs = validateStagePlan(s, plan, ctx);
    expect(errs.filter((e) => e.code === 'bad_zone')).toHaveLength(2);
    expect(errs.filter((e) => e.code === 'road_fields_dropped' && e.repaired)).toHaveLength(2);
    expect(roadShape(2.5, undefined)).toEqual({ area: 2500 * CONFIG.ROAD_WIDTH_M, aspect: 2500 / CONFIG.ROAD_WIDTH_M, danger: 'quiet' });
  });
});
