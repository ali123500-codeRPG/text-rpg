// 362 WI2 a (BG-286, BG-288, BG-289): the land's ways are made by code, once. A road of the land is one zone, a junction
// is one zone and a site is one settlement; when one is built, code joins it to the land next to it (built ground by a
// plain way, the rest as new ground keyed by the land's id and labelled from the land). Crossing that new ground builds
// that road, junction or settlement and nothing else in its place. WI5 a: one join function writes both ends of a way.
import { describe, expect, it } from 'vitest';
import type { GameState, StagePlan } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyFallbackStage, applyStagePlan } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { joinWay, landTarget, makeLandWays, mendLandWays } from '../../src/scenario/ways';
import type { Zone, ZoneLink } from '../../src/types';
import { zoneById } from '../../src/engine/relations';
import { RK, ZK } from '../../src/library/tableIds';

const road = (id: string, a: string, b: string) => ({ id, kind: 'road', danger: 'quiet', ends: [a, b], pts: [], length: 2000, crossings: [] });
const site = (id: string, name: string, at: { x: number; y: number }) => ({ id, size: 'village', name, look: '', at, why: '' });
/** Brookmere (the test village) on site s1; a fork at n2 with roads west to Ashwell and north to Hob End; a road east
 * from the village to the region's east edge, where the next region is drawn with the road running on to Eastby */
function landed(): GameState {
  const s = makeVillage({ playerZone: 'gate_inner' });
  zoneById(s, 'gate_inner')!.kind = ZK.gate;
  s.places.find((p) => p.id === 'village')!.site = 'rg_s1';
  const R = { kind: RK.river_valley, look: '', seed: 1, size: 10000, cell: 100, features: [] };
  s.regions = [{ ...R, id: 'rg', name: 'the Vale', gx: 0, gy: 0, beyond: {},
    nodes: [{ id: 'rg_n1', kind: 'site', at: { x: 5000, y: 5000 }, site: 'rg_s1' }, { id: 'rg_n2', kind: 'junction', at: { x: 4000, y: 6000 } },
      { id: 'rg_n3', kind: 'site', at: { x: 2000, y: 6000 }, site: 'rg_s2' }, { id: 'rg_n4', kind: 'site', at: { x: 4000, y: 8000 }, site: 'rg_s3' },
      { id: 'rg_n5', kind: 'edge', at: { x: 10000, y: 5000 }, side: 'e' }],
    roads: [road('rg_r1', 'rg_n1', 'rg_n2'), road('rg_r2', 'rg_n2', 'rg_n3'), road('rg_r3', 'rg_n2', 'rg_n4'), road('rg_r4', 'rg_n1', 'rg_n5')],
    sites: [{ ...site('rg_s1', 'Brookmere', { x: 5000, y: 5000 }), placeId: 'village' }, site('rg_s2', 'Ashwell', { x: 2000, y: 6000 }), site('rg_s3', 'Hob End', { x: 4000, y: 8000 })] },
  { ...R, id: 'rge', name: 'the Fells', gx: 1, gy: 0, beyond: {},
    nodes: [{ id: 'rge_n1', kind: 'edge', at: { x: 10000, y: 5040 }, side: 'w' }, { id: 'rge_n2', kind: 'site', at: { x: 13000, y: 5000 }, site: 'rge_s1' }],
    roads: [road('rge_r1', 'rge_n1', 'rge_n2')], sites: [site('rge_s1', 'Eastby', { x: 13000, y: 5000 })] }] as never;
  makeLandWays(s, [], [s.places.find((p) => p.id === 'village')!]); // the village, as if just set on its site
  return s;
}
const ext = (frontierKey: string, placeId = 'field') => ({ kind: 'extension' as const, tier: 'success' as const, placeId, frontierKey });
type PZ = StagePlan['zones'][number];
const plan = (zones: PZ[], places: StagePlan['places'] = []): StagePlan => ({ ...grovePlan(), frontiers: [], places, zones });
const zone = (key: string, more: Partial<PZ> = {}): PZ => ({ key, place: 'field', kind: ZK.road, name: key, look: 'a rutted road', links: [], ...more });
const build = (s: GameState, key: string, p: StagePlan, placeId?: string) => {
  const errors = validateStagePlan(s, p, ext(key, placeId));
  applyStagePlan(s, p, ext(key, placeId), { entry: 'open' }, createRng(1));
  return errors.map((e) => e.code);
};
const ways = (s: GameState, id: string) => zoneById(s, id)!.links.map((l) => `${l.to}${l.frontier ? ' (new)' : ''}: ${l.label}`);
const built = (s: GameState) => s.places.flatMap((p) => p.zones);

describe('362 the land\'s ways are made by code, once', () => {
  it('a settlement on its site gets a way along each land road leaving it, keyed by the road and labelled from the land', () => {
    const s = landed();
    expect(ways(s, 'gate_inner')).toEqual(expect.arrayContaining(['rg_r1 (new): the road north-west, toward a fork in the road', 'rg_r4 (new): the road east, toward the Fells']));
    makeLandWays(s, [], [s.places.find((p) => p.id === 'village')!]);
    expect(ways(s, 'gate_inner').filter((w) => w.startsWith('rg_'))).toHaveLength(2); // run again, nothing doubles
  });

  it('crossing it builds that road\'s zone once; its far end becomes new ground keyed by the junction', () => {
    const s = landed();
    expect(validateStagePlan(s, plan([zone('lane', { road: undefined })]), ext('rg_r1')).map((e) => e.code)).toContain('land_entry');
    expect(build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]))).not.toContain('land_entry');
    expect(s.regions![0].roads[0].zone).toBe('lane');
    expect(ways(s, 'gate_inner')).toContain('lane: the road north-west, toward a fork in the road');
    expect(ways(s, 'lane')).toEqual(['gate_inner: the gate', 'rg_n2 (new): the road north-west, toward a fork in the road']);
    expect(validateStagePlan(s, plan([zone('lane2', { road: 'rg_r1', links: [{ to: 'lane', label: 'on', sight: true }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }).map((e) => e.code)).toContain('road_built');
  });

  it('a junction is built once and keeps its zone; the roads meeting there join it', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    expect(validateStagePlan(s, plan([zone('fork', { kind: ZK.field })]), ext('rg_n2')).map((e) => e.code)).toContain('land_entry');
    build(s, 'rg_n2', plan([zone('fork', { kind: ZK.field, node: 'rg_n2', look: 'where three roads meet' })]));
    expect(s.regions![0].nodes[1].zone).toBe('fork');
    expect(ways(s, 'lane')).toContain('fork: the road north-west, toward a fork in the road');
    expect(ways(s, 'fork')).toEqual(['lane: lane', 'rg_r2 (new): the road west, toward Ashwell', 'rg_r3 (new): the road north, toward Hob End']);
    expect(validateStagePlan(s, plan([zone('fork2', { kind: ZK.field, node: 'rg_n2', links: [{ to: 'fork', label: 'on', sight: true }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }).map((e) => e.code)).toContain('road_built');
  });

  it('a settlement built at a road\'s end stands on the site and is joined to the road already built, with no second way', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    build(s, 'rg_n2', plan([zone('fork', { kind: ZK.field, node: 'rg_n2' })]));
    build(s, 'rg_r2', plan([zone('west', { road: 'rg_r2' })]));
    const ash = [{ key: 'ashwell', kind: 'settlement', parent: '', name: 'Ashwell', site: 'rg_s2' }];
    expect(validateStagePlan(s, plan([zone('ash_gate', { kind: ZK.yard })]), ext('rg_n3')).map((e) => e.code)).toContain('land_entry');
    expect(build(s, 'rg_n3', plan([zone('ash_gate', { place: 'ashwell', kind: ZK.gate, links: [{ to: 'ash_square', label: 'into the village', sight: true }] }), zone('ash_square', { place: 'ashwell', kind: ZK.square, links: [{ to: 'ash_gate', label: 'the gate', sight: true }, { to: 'ash_lane', label: 'a lane', sight: true }] }), zone('ash_lane', { place: 'ashwell', kind: ZK.yard })], ash), 'ashwell')).not.toContain('land_entry');
    expect(s.regions![0].sites[1].placeId).toBe('ashwell');
    expect(ways(s, 'west')).toContain('ash_gate: the road west, toward Ashwell');
    // the way in that was built is the one way between the village and the road: code adds no second one
    expect(built(s).filter((z) => z.placeId === 'ashwell').flatMap((z) => z.links).filter((l) => l.to === 'west')).toHaveLength(1);
  });

  it('a plan\'s link to a land road\'s id reaches its zone once built, else new ground keyed by it', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    applyStagePlan(s, plan([zone('shed', { kind: ZK.yard, links: [{ to: 'rg_r1', label: 'out to the road', sight: true }, { to: 'rg_r3', label: 'the far road', sight: true }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }, { entry: 'open' }, createRng(1));
    expect(ways(s, 'shed')).toEqual(['lane: out to the road', 'rg_r3 (new): the far road']);
    expect(built(s).filter((z) => z.road === 'rg_r1')).toHaveLength(1);
  });

  it('the fallback for the land\'s new ground still builds that road, so it is never built again', () => {
    const s = landed();
    applyFallbackStage(s, ext('rg_r1'), 'call_failed', []);
    const line = s.regions![0].roads[0];
    const z = zoneById(s, line.zone!)!;
    expect(z).toMatchObject({ kind: ZK.road, road: 'rg_r1' });
    expect(ways(s, z.id)).toContain('rg_n2 (new): the road north-west, toward a fork in the road');
  });

  it('a road over a region edge runs on: the next region\'s road builds the way past the edge', () => {
    const s = landed();
    expect(landTarget(s, 'rg_n5')).toEqual({ road: 'rge_r1' });
    build(s, 'rg_r4', plan([zone('east', { road: 'rg_r4' })]));
    expect(ways(s, 'east')).toContain('rg_n5 (new): the road east, toward the Fells');
    expect(validateStagePlan(s, plan([zone('fells', { road: undefined })]), ext('rg_n5')).map((e) => e.code)).toContain('land_entry');
    build(s, 'rg_n5', plan([zone('fells', { road: 'rge_r1' })]));
    expect(ways(s, 'east')).toContain('fells: the road east, toward the Fells');
    expect(ways(s, 'fells')).toContain('rge_n2 (new): the road east, toward Eastby');
  });

  it('WI5: one join writes both ends of a way, and keeps an end already there', () => {
    const s = landed();
    const a = zoneById(s, 'field_mid')!, b = zoneById(s, 'tav_cellar')!;
    joinWay(s, a, b, { label: 'a tunnel' });
    joinWay(s, b, a, { label: 'again' });
    expect(a.links.filter((l) => l.to === b.id).map((l) => l.label)).toEqual(['a tunnel']);
    expect(b.links.filter((l) => l.to === a.id).map((l) => l.label)).toEqual([a.name]);
  });
});

// WI7 a: run 17's world was built before WI2: two zones on one road (nwroad, nwroad_2), a crossroads with no junction
// record, and ways to new ground with made-up keys along the land's roads. Mended once, at load.
describe('362 a world built before WI2 is mended once', () => {
  const way = (to: string, label: string, frontier = false): ZoneLink => ({ to, label, sight: true, ...(frontier ? { frontier: true as const } : {}) });
  const add = (s: GameState, id: string, name: string, links: ZoneLink[], more: Partial<Zone> = {}) => {
    const z: Zone = { id, placeId: 'field', kind: ZK.road, name, look: '', links, cover: 'none', light: 'bright', groundItems: [], ...more };
    s.places.find((p) => p.id === 'field')!.zones.push(z);
    s.zones.push(z);
  };
  function oldWorld(): GameState {
    const s = landed();
    const gate = zoneById(s, 'gate_inner')!;
    gate.links = gate.links.filter((l) => !l.frontier).concat(way('lane', 'the north-west road'), way('lane2', 'the road north-west again'));
    add(s, 'lane', 'the north-west road', [way('gate_inner', 'back to the gate'), way('f_fork', 'up the road to the crossroads', true)], { road: 'rg_r1' });
    add(s, 'lane2', 'the north-west road', [way('gate_inner', 'back to the gate'), way('fork', 'on to the crossroads')], { road: 'rg_r1', groundItems: [{ id: 'i1', itemId: 'IT1', qty: 1 }] as never });
    add(s, 'fork', 'the crossroads', [way('lane2', 'back down the road to Brookmere'), way('west', 'the west road')], { kind: ZK.field });
    add(s, 'west', 'the west road', [way('fork', 'back to the crossroads'), way('f_ash', 'on west to Ashwell', true)], { road: 'rg_r2' });
    s.regions![0].roads[0].zone = 'lane2';
    s.regions![0].roads[1].zone = 'west';
    s.actors[0].zone = 'lane2';
    s.actors[0].placeId = 'field';
    (s.hidden as unknown as Record<string, unknown>).note = { at: 'lane2' };
    return s;
  }

  it('the copy folds into the first, the crossroads becomes the junction, and the made-up ways take the land\'s keys', () => {
    const s = oldWorld();
    const who = s.actors[0].id;
    expect(mendLandWays(s)).toEqual([
      'junction rg_n2 is fork', 'the way from lane toward rg_n2 leads to fork', 'the way from west toward rg_n3 is keyed by it (was f_ash)', 'lane2 folded into lane, road rg_r1']);
    expect(zoneById(s, 'lane2')).toBeUndefined();
    expect(s.places.flatMap((p) => p.zones).some((z) => z.id === 'lane2')).toBe(false);
    expect(s.regions![0].roads[0].zone).toBe('lane');
    expect(ways(s, 'gate_inner').filter((w) => w.startsWith('lane'))).toEqual(['lane: the north-west road']); // one way, not two
    expect(ways(s, 'lane')).toEqual(['gate_inner: back to the gate', 'fork: up the road to the crossroads']);
    expect(ways(s, 'fork')).toEqual(['west: the west road', 'lane: back down the road to Brookmere']);
    expect(ways(s, 'west')).toContain('rg_n3 (new): on west to Ashwell');
    expect(s.actors.find((a) => a.id === who)!.zone).toBe('lane');
    expect(zoneById(s, 'lane')!.groundItems.map((i) => i.id)).toEqual(['i1']);
    expect((s.hidden as unknown as Record<string, { at: string }>).note.at).toBe('lane');
    expect(mendLandWays(s)).toEqual([]); // once
  });

  it('a world built with WI2 needs no mending', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    build(s, 'rg_n2', plan([zone('fork', { kind: ZK.field, node: 'rg_n2' })]));
    expect(mendLandWays(s)).toEqual([]);
  });
});
