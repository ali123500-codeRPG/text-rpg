// 362 WI2 a (BG-286, BG-288, BG-289): the land's ways are made by code, once. A road of the land is one zone, a junction
// is one title and a site is one settlement; when one is built, code joins it to the land next to it (built ground by a
// plain way, the rest as new ground keyed by the land's id and labelled from the land). Crossing that new ground builds
// that road, junction or settlement and nothing else in its place. WI5 a: one join function writes both ends of a way.
import { describe, expect, it } from 'vitest';
import type { GameState, StagePlan } from '../../src/types';
import { createRng } from '../harness';
import { landed } from '../harness/land';
import { applyFallbackStage, applyStagePlan } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import { joinWay, landTarget, makeLandWays } from '../../src/scenario/ways';
import { waysOut } from '../../src/plan/where';
import { zoneById } from '../../src/engine/relations';
import { ZK } from '../../src/library/tableIds';

const ext = (frontierKey: string, placeId = 'field') => ({ kind: 'extension' as const, tier: 'success' as const, placeId, frontierKey });
type PZ = StagePlan['zones'][number];
const plan = (zones: PZ[], places: StagePlan['places'] = []): StagePlan => ({ ...grovePlan(), frontiers: [], places, zones });
/** a road (no kind) unless more gives a kind */
const zone = (key: string, more: Partial<PZ> = {}): PZ => ({ key, place: 'field', name: key, look: 'a rutted road', ways: [], ...more });
const build = (s: GameState, key: string, p: StagePlan, placeId?: string) => {
  const errors = validateStagePlan(s, p, ext(key, placeId));
  applyStagePlan(s, p, ext(key, placeId), { entry: 'open' }, createRng(1));
  return errors.map((e) => e.code);
};
const ways = (s: GameState, id: string) => waysOut(s, id).map((l) => `${l.to}${l.frontier ? ' (new)' : ''}: ${l.label}`);
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
    expect(validateStagePlan(s, plan([zone('lane2', { road: 'rg_r1', ways: [{ to: 'lane', label: 'on' }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }).map((e) => e.code)).toContain('road_built');
  });

  it('a junction is built once and keeps its zone; the roads meeting there join it', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    expect(validateStagePlan(s, plan([zone('fork', { kind: ZK.field })]), ext('rg_n2')).map((e) => e.code)).toContain('land_entry');
    build(s, 'rg_n2', plan([zone('fork', { kind: ZK.field, node: 'rg_n2', look: 'where three roads meet' })]));
    expect(s.regions![0].nodes[1].zone).toBe('fork');
    expect(ways(s, 'lane')).toContain('fork: the road north-west, toward a fork in the road');
    expect(ways(s, 'fork')).toEqual(['lane: lane', 'rg_r2 (new): the road west, toward Ashwell', 'rg_r3 (new): the road north, toward Hob End']);
    expect(validateStagePlan(s, plan([zone('fork2', { kind: ZK.field, node: 'rg_n2', ways: [{ to: 'fork', label: 'on' }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }).map((e) => e.code)).toContain('road_built');
  });

  it('a settlement built at a road\'s end stands on the site and is joined to the road already built, with no second way', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    build(s, 'rg_n2', plan([zone('fork', { kind: ZK.field, node: 'rg_n2' })]));
    build(s, 'rg_r2', plan([zone('west', { road: 'rg_r2' })]));
    const ash = [{ key: 'ashwell', kind: 'settlement', parent: '', name: 'Ashwell', site: 'rg_s2' }];
    expect(validateStagePlan(s, plan([zone('ash_gate', { kind: ZK.yard })]), ext('rg_n3')).map((e) => e.code)).toContain('land_entry');
    expect(build(s, 'rg_n3', plan([zone('ash_gate', { place: 'ashwell', kind: ZK.gate, ways: [{ to: 'ash_square', label: 'into the village' }] }), zone('ash_square', { place: 'ashwell', kind: ZK.square, ways: [{ to: 'ash_gate', label: 'the gate' }, { to: 'ash_lane', label: 'a lane' }] }), zone('ash_lane', { place: 'ashwell', kind: ZK.yard })], ash), 'ashwell')).not.toContain('land_entry');
    expect(s.regions![0].sites[1].placeId).toBe('ashwell');
    expect(ways(s, 'west')).toContain('ash_gate: the road west, toward Ashwell');
    // the way in that was built is the one way between the village and the road: code adds no second one
    expect(built(s).filter((z) => z.placeId === 'ashwell').flatMap((z) => waysOut(s, z.id)).filter((l) => l.to === 'west')).toHaveLength(1);
  });

  it('a plan\'s link to a land road\'s id reaches its zone once built, else new ground keyed by it', () => {
    const s = landed();
    build(s, 'rg_r1', plan([zone('lane', { road: 'rg_r1' })]));
    applyStagePlan(s, plan([zone('shed', { kind: ZK.yard, ways: [{ to: 'rg_r1', label: 'out to the road' }, { to: 'rg_r3', label: 'the far road' }] })]), { kind: 'scenario', tier: 'success', placeId: 'field' }, { entry: 'open' }, createRng(1));
    expect(ways(s, 'shed')).toEqual(['lane: out to the road', 'rg_r3 (new): the far road']);
    expect(built(s).filter((z) => z.road === 'rg_r1')).toHaveLength(1);
  });

  it('the fallback for the land\'s new ground still builds that road, so it is never built again', () => {
    const s = landed();
    applyFallbackStage(s, ext('rg_r1'), 'call_failed', []);
    const line = s.regions![0].roads[0];
    const z = zoneById(s, line.zone!)!;
    expect(z).toMatchObject({ road: 'rg_r1' });
    expect(z.kind).toBeUndefined();
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
    expect(waysOut(s, a.id).filter((l) => l.to === b.id).map((l) => l.label)).toEqual(['a tunnel']);
    expect(waysOut(s, b.id).filter((l) => l.to === a.id).map((l) => l.label)).toEqual([a.name]);
  });
});
