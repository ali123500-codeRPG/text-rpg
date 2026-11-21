// 417 BG-1507: the World builder cast a road's group under the group's roster key (rg_0_0_r3.g1) and left out roster, so
// nothing said who the entry was and the plan was refused (bad_cast: names no template, composition or actor), three
// times in one story. An entry keyed by a roster key that names nobody else is that roster entry.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import type { StagePlan } from '../../src/types';
import { validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { drawRegion, type RegionBrief } from '../../src/land/generate';
import { roadRoster, siteRoster } from '../../src/land/roster';
import { RK } from '../../src/library/tableIds';

const brief: RegionBrief = {
  kind: RK.river_valley, name: 'Vale', look: 'a broad vale', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: '', where: 'crossing' }, { size: 'village', name: 'Thornbury', look: '' }],
  features: [], beyond: {},
};
const region = drawRegion('rg1', 0, 0, 4242, brief);
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const withLand = () => { const s = toStoryStart(makeVillage()); s.regions = [structuredClone(region)]; return s; };
const castAs = (key: string, extra: Partial<StagePlan['cast'][number]> = {}): StagePlan => {
  const p = villageStagePlan();
  p.cast.push({ key, label: 'the leader', name: 'Orla', appearance: 'a grey cloak', band: 'village_watch', routineSetId: 'gate_guard',
    slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'keeps the road', ...extra } as never);
  return p;
};

it('a road group cast under its roster key, with no roster, is that group: its leader and followers', () => {
  const s = withLand();
  const g = region.roads.flatMap((r) => roadRoster(r))[0];
  const p = castAs(g.key);
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  const lead = p.cast.find((c) => c.key === g.key)!;
  expect(lead.roster).toBe(g.key);
  expect(lead.template ?? lead.compose).toBeDefined();
});

it('a site hook cast under its key is filled the same way; an entry that names who it is keeps that', () => {
  const s = withLand();
  const h = siteRoster(region.sites.find((x) => x.size === 'village')!)[0];
  const p = castAs(h.key);
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  expect(p.cast.at(-1)!.compose).toEqual(h.compose);
  const own = castAs(h.key, { actor: 'guard_1' });
  validateStagePlan(s, own, ctx);
  expect(own.cast.at(-1)!.roster).toBeUndefined();
});

it('a key that is no roster entry still names nobody, and the plan is refused', () => {
  expect(validateStagePlan(withLand(), castAs('rg1_r99.g1'), ctx).map((e) => e.code)).toContain('bad_cast');
});
