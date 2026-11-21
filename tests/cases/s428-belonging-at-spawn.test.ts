// 428 BB1 a, BB2 a (D-1768): who a plan casts belongs somewhere. A recipe's people get a tie to its organization: the
// settlement's own watch, a unit of its council (found or made there), or a new gang, company or pack of their own, headed
// by its lead. A caravan's guards are hired by its master in person. Each settlement has a council that holds the place
// and whose law runs there: its Leader is the head, its Warden an officer; a Seat of the Great holds the place over it.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { GameState, StagePlan } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { drawRegion, type RegionBrief } from '../../src/land/generate';
import { roadRoster, siteRoster } from '../../src/land/roster';
import { GP, HK } from '../../src/library/npcLayerIds';
import { RK } from '../../src/library/tableIds';

const brief: RegionBrief = {
  kind: RK.river_valley, name: 'Vale', look: 'a broad vale', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: '', where: 'crossing' }, { size: 'village', name: 'Thornbury', look: '' }],
  features: [], beyond: {},
};
const region = drawRegion('rg1', 0, 0, 4242, brief);
for (const r of region.roads) r.danger = 'safe'; // safe roads roll watch patrols
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const town = region.sites.find((x) => x.size === 'town')!;
const village = region.sites.find((x) => x.size === 'village')!;

/** the village fixture, its top place standing on `site`, with these entries cast */
function play(site: string | undefined, ...cast: Partial<StagePlan['cast'][number]>[]): GameState {
  const s = toStoryStart(makeVillage());
  s.regions = [structuredClone(region)];
  const p = villageStagePlan();
  if (site) p.places.find((x) => !x.parent)!.site = site;
  cast.forEach((c, i) => p.cast.push({ key: `x${i}`, label: 'someone', name: `N${i}`, appearance: 'plain', band: 'village_watch', routineSetId: 'gate_guard',
    slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'here', ...c } as never));
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
  return s;
}
const named = (s: GameState, n: string) => s.actors.find((a) => a.names.current === n)!;
const org = (s: GameState, id: string) => s.organizations?.find((o) => o.id === id);

describe('428 belonging at spawn', () => {
  it('a bandit company is a new company: its captain the head, its chiefs officers, every member sworn and open', () => {
    const s = play(undefined, { group: { id: GP.bandit_company, rank: 'Trained' } });
    const cap = named(s, 'N0'), o = org(s, `org_${cap.id}`)!;
    expect(o).toMatchObject({ kind: 'company', headId: cap.id });
    expect(o.closeKnit).toBeUndefined();
    const members = s.actors.filter((a) => a.ties?.some((t) => 'org' in t.to && t.to.org === o.id));
    expect(members.length).toBeGreaterThanOrEqual(9);
    expect(o.officerIds!.map((id) => s.actors.find((a) => a.id === id)!.label)).toEqual(['a gang chief', 'a gang chief']);
    for (const m of members) expect(m.ties![0]).toMatchObject({ status: 'member', commitment: 'sworn', cover: 'open', title: m === cap ? 'someone' : m.label.replace(/^a /, '') });
  });

  it('a gang and a pack are crews of their own; wolves are devoted and untitled', () => {
    const s = play(undefined, { group: { id: GP.bandit_gang, rank: 'Trained' } }, { group: { id: GP.wolf_pack, rank: 'Trained' }, band: 'village_watch' });
    const gang = org(s, `org_${named(s, 'N0').id}`)!, pack = org(s, `org_${named(s, 'N1').id}`)!;
    expect(gang).toMatchObject({ kind: 'gang', closeKnit: true });
    expect(pack).toMatchObject({ kind: 'pack', closeKnit: true });
    const wolves = s.actors.filter((a) => a.ties?.some((t) => 'org' in t.to && t.to.org === pack.id));
    expect(wolves.length).toBeGreaterThanOrEqual(3);
    for (const w of wolves) { expect(w.ties![0].commitment).toBe('devoted'); expect(w.ties![0].title).toBeUndefined(); }
  });

  it("a caravan's guards are hired by its master, bound by pay; the master belongs to nothing", () => {
    const s = play(undefined, { group: { id: GP.caravan, rank: 'Trained' } });
    const master = named(s, 'N0');
    const guards = s.actors.filter((a) => a.label === 'a hired guard');
    expect(guards.length).toBe(2);
    for (const g of guards) expect(g.ties).toEqual([expect.objectContaining({ to: { person: master.id }, status: 'hired', commitment: 'bound', title: 'hired guard' })]);
    expect(master.ties ?? []).toEqual([]);
    expect(s.organizations?.some((o) => o.kind !== 'council')).toBeFalsy();
  });

  it("a town's watch is found, not made twice; a unit of its council, which holds the town and gives its law", () => {
    const s = play(town.id, { group: { id: GP.watch_garrison, rank: 'Trained' } }, { group: { id: GP.watch_patrol, rank: 'Trained' } });
    const watch = org(s, `org_${town.id}_watch`)!, council = org(s, `org_${town.id}_council`)!;
    expect(s.organizations!.filter((o) => o.kind === 'watch').length).toBe(1);
    expect(watch).toMatchObject({ name: 'the Marbury Watch', parentId: council.id, headId: named(s, 'N0').id });
    expect(watch.officerIds!.length).toBe(2); // the garrison's sergeants; the patrol's sergeant is a member
    expect(named(s, 'N1').ties![0]).toMatchObject({ to: { org: watch.id }, title: 'someone' });
    const place = s.places.find((p) => p.site === town.id)!;
    expect(council).toMatchObject({ name: 'the Marbury council', kind: 'council', seat: place.id });
    expect(place).toMatchObject({ holder: { org: council.id }, law: { org: council.id } });
  });

  it("a road's watch patrol belongs to the nearest settlement's watch", () => {
    const e = region.roads.flatMap((r) => roadRoster(r)).find((x) => x.group?.id === GP.watch_patrol)!;
    const road = region.roads.find((r) => e.key.startsWith(`${r.id}.`))!;
    const near = [...region.sites].sort((a, b) => Math.min(...road.pts.map((p) => Math.hypot(p.x - a.at.x, p.y - a.at.y))) - Math.min(...road.pts.map((p) => Math.hypot(p.x - b.at.x, p.y - b.at.y))))[0];
    const s = play(undefined, { key: e.key, roster: e.key });
    expect(s.actors.some((a) => a.ties?.some((t) => 'org' in t.to && t.to.org === `org_${near.id}_watch`))).toBe(true);
  });

  it("the village's Leader heads its council and its Warden is an officer; a Seat of the Great holds the place over it", () => {
    const hooks = siteRoster(village);
    const leader = hooks.find((h) => h.hook === HK.leader)!, warden = hooks.find((h) => h.hook === HK.warden)!;
    const s = play(village.id, { key: leader.key, roster: leader.key, label: 'the headman' }, { key: warden.key, roster: warden.key, label: 'the warden' });
    const c = org(s, `org_${village.id}_council`)!;
    expect(c.headId).toBe(named(s, 'N0').id);
    expect(c.officerIds).toEqual([named(s, 'N1').id]);
    expect(named(s, 'N0').ties![0]).toMatchObject({ to: { org: c.id }, commitment: 'sworn', cover: 'open', title: 'headman' });
    const seatHook = region.sites.flatMap((x) => siteRoster(x)).find((h) => h.hook === HK.seat)!;
    const site = region.sites.find((x) => seatHook.key.startsWith(`${x.id}.`))!;
    const t = play(site.id, { key: seatHook.key, roster: seatHook.key, label: 'the lady of the vale' });
    const lady = named(t, 'N0'), place = t.places.find((p) => p.site === site.id)!;
    expect(place.holder).toEqual({ person: lady.id });
    expect(place.law).toEqual({ org: `org_${site.id}_council` });
    expect(t.orgLinks).toContainEqual(expect.objectContaining({ a: { org: `org_${site.id}_council` }, b: { person: lady.id }, kind: 'registered_with' }));
    expect(lady.ties ?? []).toEqual([]);
  });
});
