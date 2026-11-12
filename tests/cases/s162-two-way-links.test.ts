// Every zone link runs both ways: a plan's one-way links among its own new zones get their way back, and a save made
// before the fix is repaired on load (a played story's back yard had no exit: the street and the common room linked in, nothing out).
import { describe, expect, it } from 'vitest';
import { applyStagePlan, type PlanContext } from '../../src/scenario';
import { repairReferences, newReport } from '../../src/save/checks';
import { getLibrary } from '../../src/library';
import { createRng } from '../../src/rng';
import { makeVillage } from '../harness';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import type { Place } from '../../src/types';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const fresh = () => toStoryStart(makeVillage());

describe('162 two-way links', () => {
  it('a planned zone with only links in gets every way back', () => {
    const s = fresh();
    const plan = villageStagePlan();
    const keys = new Set(plan.zones.map((z) => z.key));
    for (const z of plan.zones.slice(1)) z.links = z.links.filter((l) => !keys.has(l.to)); // only the first zone links out
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    for (const z of s.zones) for (const l of z.links) {
      if (l.frontier) continue;
      const other = s.zones.find((x) => x.id === l.to)!;
      expect(other.links.some((b) => b.to === z.id), `${l.to} back to ${z.id}`).toBe(true);
    }
  });
  it('a saved one-way link is repaired on load', () => {
    const zone = (id: string, links: { to: string; label: string; sight: boolean }[]) => ({ id, placeId: 'p', name: `the ${id}`, look: '', links, cover: 'none', light: 'dim', groundItems: [] });
    const place = { id: 'p', storyId: 's', kind: 'tavern', names: { current: 'P', past: [] }, parentId: null, headlines: [], state: {},
      zones: [zone('common', [{ to: 'yard', label: 'the back door', sight: false }]), zone('yard', [])] } as unknown as Place;
    const pages = { 'place.p': place } as never;
    const r = newReport();
    repairReferences(pages, getLibrary(), r);
    expect(place.zones[1].links).toEqual([{ to: 'common', label: 'the common', sight: false }]);
    expect(r.changed.has('place.p')).toBe(true);
  });
});
