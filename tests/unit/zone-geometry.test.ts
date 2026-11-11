// CO15/CO16: zones get an area in m² and an edge kind per side, from the kind unless the Weaver names others.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { EK } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scene';
import { toStoryStart, villageStagePlan } from '../../src/scene/fixtures';
import type { StagePlan } from '../../src/types';

const ctx: PlanContext = { tier: 'success', kind: 'scene', placeId: 'tavern' };
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
