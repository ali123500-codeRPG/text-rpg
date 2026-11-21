// 363 WI9 a / WI10 a: the world check. A road is one area, a junction one outdoor area, a site one settlement (areas
// around a junction and places inside a settlement are free); every built road ending at a junction or site leads into
// it, or on to new ground keyed by it while it is unbuilt; no new ground leads to built land; every way leads to an area.
// Two ways between the same two areas are allowed (WI6). A plan that would break one goes back for repair; a save that
// breaks one loads, and the break is filed as a bug.
import { describe, expect, it, vi } from 'vitest';
import type { GameState, StagePlan, TurnRecord } from '../../src/types';
import { createRng } from '../harness';
import { landed } from '../harness/land';
import { applyStagePlan } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { grovePlan } from '../../src/scenario/fixtures';
import * as ways from '../../src/scenario/ways';
import { worldCheck } from '../../src/scenario/ways';
import { zoneById } from '../../src/engine/relations';
import { addFrontier, joinWay } from '../../src/plan/draw';
import { loadStory, memoryStore, saveTurn } from '../../src/save';
import { getLibrary } from '../../src/library';

const ext = (frontierKey: string) => ({ kind: 'extension' as const, tier: 'success' as const, placeId: 'field', frontierKey });
type PZ = StagePlan['zones'][number];
const plan = (zones: PZ[]): StagePlan => ({ ...grovePlan(), frontiers: [], places: [], zones });
const lane = (more: Partial<PZ> = {}): PZ => ({ key: 'lane', place: 'field', name: 'the north-west road', look: 'a rutted road', ways: [], road: 'rg_r1', ...more });
const build = (s: GameState) => applyStagePlan(s, plan([lane()]), ext('rg_r1'), { entry: 'open' }, createRng(1));

describe('363 the world check', () => {
  it('a world built by the rules passes, two doors between the same two areas too; then it names each broken rule: a second area on a road, a road not leading into its built end, new ground to built land, a second settlement on a site, a junction area indoors', () => {
    const s = landed();
    build(s);
    expect(worldCheck(s)).toEqual([]);
    expect(joinWay(s, zoneById(s, 'tav_common')!, zoneById(s, 'street_door')!, { label: 'the side door', kind: 'door' })).toBeDefined();
    expect(worldCheck(s)).toEqual([]);
    const copy = structuredClone(zoneById(s, 'lane')!);
    copy.id = 'lane_2';
    s.places.find((p) => p.id === 'field')!.zones.push(copy);
    s.zones.push(copy);
    s.openings = s.openings.filter((o) => !(o.joins.includes('gate_inner') && o.joins.includes('lane')));
    addFrontier(s, zoneById(s, 'gate_inner')!, 'rg_r1', 'the old road');
    expect(worldCheck(s)).toEqual(expect.arrayContaining([
      'road rg_r1 has 2 areas (lane, lane_2); a road is one area',
      'gate_inner\'s way "the old road" is new ground, but rg_r1 is already built as lane',
    ]));
    s.places.push({ ...s.places.find((p) => p.id === 'village')!, id: 'village_2', zones: [] });
    s.regions![0].nodes[1].zone = 'tav_common';
    expect(worldCheck(s)).toEqual(expect.arrayContaining(['site rg_s1 has 2 settlements (village, village_2); a site holds one', 'junction rg_n2\'s area tav_common is indoors']));
  });

  it('a plan that would break a rule goes back for repair', () => {
    const s = landed();
    // as if code forgot the way on from the new road (WI2): the copy the plan is tried on shows it
    const spy = vi.spyOn(ways, 'makeLandWays').mockImplementation(() => {});
    const errors = validateStagePlan(s, plan([lane()]), ext('rg_r1'));
    spy.mockRestore();
    expect(errors.filter((e) => e.code === 'world_check').map((e) => e.message)).toEqual([
      'after this plan, road rg_r1\'s area lane has no way on toward its unbuilt end rg_n2: keep the land\'s roads, junctions and settlements built once']);
    expect(validateStagePlan(s, plan([lane()]), ext('rg_r1')).some((e) => e.code === 'world_check')).toBe(false);
    expect(zoneById(s, 'lane')).toBeUndefined(); // only the copy was built
  });

  it('a save that breaks a rule loads anyway, and the break is filed as a bug', async () => {
    const s = landed();
    s.places.push({ ...s.places.find((p) => p.id === 'village')!, id: 'village_2', zones: [] });
    const st = memoryStore();
    await saveTurn(st, s, { storyId: s.storyId, turn: 0, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] } as TurnRecord);
    const { state, report } = await loadStory(st, s.storyId, getLibrary());
    expect(report).toContain('warning: world check: site rg_s1 has 2 settlements (village, village_2); a site holds one');
    expect(state.log.filter((l) => l.code === 'world_check').map((l) => l.detail)).toEqual([{ broken: 'site rg_s1 has 2 settlements (village, village_2); a site holds one' }]);
  });
});
