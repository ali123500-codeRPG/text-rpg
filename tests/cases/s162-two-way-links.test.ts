// Every way runs both ways: a plan's one-way links among its own new zones get their way back (a played story's back yard
// had no exit: the street and the common room linked in, nothing out). PZ2: a way is one opening joining two titles, read
// from either side, so a saved one-way link cannot happen.
import { describe, expect, it } from 'vitest';
import { applyStagePlan, type PlanContext } from '../../src/scenario';
import { createRng } from '../../src/rng';
import { makeVillage } from '../harness';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { waysOut } from '../../src/plan/where';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const fresh = () => toStoryStart(makeVillage());

describe('162 two-way links', () => {
  it('a planned zone with only links in gets every way back', () => {
    const s = fresh();
    const plan = villageStagePlan();
    const keys = new Set(plan.zones.map((z) => z.key));
    for (const z of plan.zones.slice(1)) z.ways = z.ways.filter((l) => !keys.has(l.to)); // only the first zone links out
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    for (const z of s.zones) for (const l of waysOut(s, z.id)) {
      if (l.frontier) continue;
      const other = s.zones.find((x) => x.id === l.to)!;
      expect(waysOut(s, other.id).some((b) => b.to === z.id), `${l.to} back to ${z.id}`).toBe(true);
    }
  });
});
