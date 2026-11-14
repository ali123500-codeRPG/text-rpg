// 315 WZ1, WZ2, WZ4, WZ13: a story draws its first region before its first plan, from the Weaver's brief; the opening
// village stands on the brief's start site, the Weaver sees the land in words, a road zone along a road of the land takes
// its real length, and the player makes out the land around them from outdoors.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { TIERS } from '../../src/scales';
import { ScenarioDirector } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';
import { RK, ZK } from '../../src/library/tableIds';
import { landSeen } from '../../src/land/sight';
import { noteZonesSeen } from '../../src/engine/trail';
import { toPages, fromPages } from '../../src/save/pages';
import type { GameState, Head, WeaverView } from '../../src/types';

const BRIEF = {
  kind: RK.river_valley, name: 'The Wendvale', look: 'A broad green vale.', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: 'a market town', where: 'crossing' }, { size: 'village', name: 'Thornbury', look: 'a slime-troubled village', start: true }, { size: 'hamlet', name: 'Hob End', look: '' }],
  features: [{ kind: 'LM3', name: 'the burnt tower', look: '' }, { kind: 'LM99', name: 'nowhere', look: '' }],
  beyond: { n: { name: 'the Fells', kind: RK.upland_moor } }, exits: ['n', 'e'],
};

async function start(brief: unknown = BRIEF): Promise<{ s: GameState; views: WeaverView[] }> {
  const s = toStoryStart(makeVillage());
  s.regions = undefined;
  const views: WeaverView[] = [];
  const d = new ScenarioDirector({ weave: async (view) => { views.push(view); return villageStagePlan(TIERS.keyOf(view.tier)!); }, clock: new VirtualClock(), region: async () => brief });
  await d.storyStart(s, createRng(s.rngState));
  return { s, views };
}

describe('315 land first', () => {
  it('draws the region from the brief, and the opening village stands on the start site', async () => {
    const { s, views } = await start();
    const r = s.regions![0];
    expect(r).toMatchObject({ name: 'The Wendvale', kind: RK.river_valley, gx: 0, gy: 0 });
    expect(r.features.map((f) => f.name)).toEqual(['the burnt tower']); // an unknown landmark kind is dropped
    const site = r.sites.find((x) => x.id === r.start)!;
    expect(site.name).toBe('Thornbury');
    const village = s.places.find((p) => p.site === site.id)!;
    expect(village.parentId).toBeNull();
    expect(site.placeId).toBe(village.id);
    // the village's zones sit on the site, not at the world's origin
    const z = s.places.filter((p) => p.id === village.id || p.parentId === village.id).flatMap((p) => p.zones).find((x) => x.rect)!;
    expect(Math.hypot(z.rect!.x - site.at.x, z.rect!.y - site.at.y)).toBeLessThan(500);
    // the Weaver saw the land in words
    expect(views[0].land).toMatchObject({ name: 'The Wendvale', start: site.id });
    expect(views[0].land!.roads.length).toBeGreaterThan(0);
  });

  it('draws the region from its kind alone when no brief comes back', async () => {
    const { s } = await start(null);
    expect(s.regions![0].kind).toBe(RK.river_valley);
    expect(s.regions![0].sites.length).toBeGreaterThan(2);
    expect(s.log.some((l) => l.code === 'region_brief_fallback')).toBe(true);
  });

  it('a road zone along a road of the land takes its length and danger from it', async () => {
    const { s } = await start();
    const line = s.regions![0].roads[0];
    line.danger = 'wild';
    const d = new ScenarioDirector({ clock: new VirtualClock(), weave: async (view) => ({
      ...villageStagePlan(TIERS.keyOf(view.tier)!),
      places: [{ key: 'way', name: 'the vale road', kind: 'road', parent: '' }],
      zones: [{ key: 'vale_road', place: 'way', kind: ZK.road, name: 'the vale road', look: 'a cart track', road: line.id, links: [{ to: s.player.zone, label: 'back', sight: true }, { to: 'beyond', label: 'on', sight: true }] }],
      frontiers: [{ key: 'beyond', label: 'on' }], cast: [], bands: [],
    }) });
    s.stage.breakCause = 'scenario_end';
    await d.startScenario(s, createRng(5));
    const road = s.places.flatMap((p) => p.zones).find((z) => z.road === line.id)!;
    expect(road).toBeDefined();
    expect(road.danger).toBe('wild');
    expect(Math.max(road.rect!.w, road.rect!.d)).toBeCloseTo(line.length, -1);
    expect(line.zone).toBe(road.id);
  });

  it('from outdoors the player makes out the land around them, and it is saved', async () => {
    const { s } = await start();
    const out = s.places.flatMap((p) => p.zones).find((z) => z.outdoor && z.rect)!;
    s.player.zone = out.id; s.player.placeId = out.placeId; s.player.pos = { x: out.rect!.x, y: out.rect!.y };
    noteZonesSeen(s);
    const r = s.regions![0], seen = landSeen(s, r.id);
    const n = r.heights.filter((_, i) => seen(i)).length;
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(r.heights.length);
    const back = fromPages(s.meta, { libraryVersion: s.libraryVersion } as Head, toPages(s));
    expect(back.regions).toEqual(s.regions);
    expect(back.player.journal!.landSeen).toEqual(s.player.journal!.landSeen);
  });
});
