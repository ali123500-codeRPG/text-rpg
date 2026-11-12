// CO15/CO16: zones get an area in m² and an edge kind per side, from the kind unless the Weaver names others.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { EK, LY, ZK } from '../../src/library/tableIds';
import { roadShape } from '../../src/scenario/apply';
import { getLibrary } from '../../src/library';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import type { StagePlan } from '../../src/types';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const zoneOf = (s: ReturnType<typeof makeVillage>, key: string) => s.places.flatMap((p) => p.zones).find((z) => z.id.endsWith(key) || z.name === key);

describe('zone sizes and edges', () => {
  it('every size and edge kind has a library row; sizes grow smallest first', () => {
    const lib = getLibrary();
    const m2 = Object.values(lib.zoneSizes!).map((z) => z.m2);
    expect(m2).toEqual([...m2].sort((a, b) => a - b));
    expect(Object.values(lib.zoneSizes!).every((z) => z.like.length > 0)).toBe(true);
    for (const k of Object.values(lib.zoneKinds!)) { expect(CONFIG.ZONE_SIZE_M2[k.size]).toBeGreaterThan(0); expect(lib.edgeKinds![k.edge]).toBeDefined(); }
  });

  it('a zone takes its kind\'s size and edges; the Weaver can change one side or give m²', () => {
    const s = toStoryStart(makeVillage());
    const plan: StagePlan = villageStagePlan();
    const [first, second] = plan.zones;
    first.edges = { n: EK.low };
    second.area = 140;
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const a = zoneOf(s, first.name)!, b = zoneOf(s, second.name)!;
    const kind = getLibrary().zoneKinds![first.kind];
    expect(a.area).toBe(CONFIG.ZONE_SIZE_M2[kind.size]);
    expect(a.edges).toEqual({ n: EK.low, e: kind.edge, s: kind.edge, w: kind.edge });
    expect(b.area).toBe(140);
  });

  it('an unknown size or edge kind fails validation (and so is filed as a bug)', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones[0].size = 'huge';
    plan.zones[1].edges = { n: 'EK99' };
    expect(validateStagePlan(s, plan, ctx).filter((e) => e.code === 'bad_zone')).toHaveLength(2);
  });
});

describe('layouts (CO17)', () => {
  it('a place that names a layout gets its zones, keyed placeKey.zoneKey, sized, sided and placed; they skip the zone cap', () => {
    const s = toStoryStart(makeVillage());
    CONFIG.PLAN_CAPS = { ...CONFIG.PLAN_CAPS, places: 5 }; // the fixture plan already uses 4 places
    const plan = villageStagePlan();
    plan.places.push({ key: 'smithy', name: 'Hob\'s Smithy', kind: 'place', parent: 'village', layout: LY.smithy, names: { forge: 'Hob\'s forge' } });
    plan.zones.find((z) => z.key === 'street_door')!.links.push({ to: 'smithy.forge', label: 'the smithy, east', sight: true });
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    expect(plan.zones.filter((z) => z.fromLayout)).toHaveLength(getLibrary().layouts![LY.smithy].zones.length);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const forge = zoneOf(s, 'Hob\'s forge')!, coal = zoneOf(s, 'coal store')!;
    expect(forge.edges!.s).toBe(EK.open);
    expect(forge.rect && coal.rect).toBeTruthy();
    expect(coal.rect!.x).toBeGreaterThan(forge.rect!.x); // "the coal store, east"
    expect(forge.links.some((l) => l.to === zoneOf(s, 'outside the tavern')!.id)).toBe(true); // back link added
  });

  it('an unknown layout fails validation', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.places.push({ key: 'x', name: 'X', kind: 'place', parent: 'village', layout: 'LY99' });
    expect(validateStagePlan(s, plan, ctx).some((e) => e.code === 'bad_place')).toBe(true);
  });

  it('every layout is well formed: kinds, sizes, edges and links resolve, and the entry exists', () => {
    const lib = getLibrary();
    for (const l of Object.values(lib.layouts!)) {
      const keys = new Set(l.zones.map((z) => z.key));
      expect(keys.has(l.entry)).toBe(true);
      for (const z of l.zones) {
        expect(lib.zoneKinds![z.kind]).toBeDefined();
        if (z.size) expect(CONFIG.ZONE_SIZE_M2[z.size]).toBeGreaterThan(0);
        for (const ek of Object.values(z.edges ?? {})) expect(lib.edgeKinds![ek!]).toBeDefined();
        for (const [to] of z.links) expect(keys.has(to)).toBe(true);
      }
    }
  });
});

describe('roads (TV3, TV4)', () => {
  it('a road is one long zone: its length word or km sets the rectangle, ROAD_WIDTH_M wide, with its danger', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones.push({ key: 'north_road', place: plan.zones.find((z) => z.key === 'street_door')!.place, kind: ZK.road, name: 'the north road', look: 'a rutted cart track',
      length: 'day', danger: 'wild', links: [{ to: 'street_door', label: 'back to the village, south', sight: true }, { to: 'far_north', label: 'on north', sight: true }] });
    plan.frontiers.push({ key: 'far_north', label: 'on north' });
    plan.zones.find((z) => z.key === 'street_door')!.links.push({ to: 'north_road', label: 'the north road', sight: true });
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    const road = zoneOf(s, 'the north road')!;
    expect(road.danger).toBe('wild');
    expect(Math.max(road.rect!.w, road.rect!.d)).toBeCloseTo(30000);
    expect(Math.min(road.rect!.w, road.rect!.d)).toBeCloseTo(CONFIG.ROAD_WIDTH_M);
    expect(road.rect!.y).toBeGreaterThan(zoneOf(s, plan.zones.find((z) => z.key === 'street_door')!.name)!.rect!.y); // north of the street
  });

  it('only a road takes a length or danger; a bad word fails validation', () => {
    const s = toStoryStart(makeVillage());
    const plan = villageStagePlan();
    plan.zones[0].length = 'hour';
    plan.zones[1].danger = 'wild';
    plan.zones.push({ key: 'r', place: plan.zones[0].place, kind: ZK.road, name: 'a road', look: 'a road', length: 'forever', danger: 'deadly', links: [] });
    expect(validateStagePlan(s, plan, ctx).filter((e) => e.code === 'bad_zone')).toHaveLength(4);
    expect(roadShape(2.5, undefined)).toEqual({ area: 2500 * CONFIG.ROAD_WIDTH_M, aspect: 2500 / CONFIG.ROAD_WIDTH_M, danger: 'quiet' });
  });
});
