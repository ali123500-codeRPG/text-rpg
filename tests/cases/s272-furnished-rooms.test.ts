// 272 FR1–FR5 (Speech with actions, furnished rooms): a zone lists named furniture with where it stands. Its kind gives
// defaults, a layout its own, and the Weaver may replace either (FR2). A move can end beside a piece (spot near its id).
// A piece on an edge (the bar counter) is one record and shows on both sides (FR4). The views and the map list it (FR5).
import { expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { FU, LY } from '../../src/library/tableIds';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { furnitureIn, furniturePos, furnitureWhere, makeFurniture } from '../../src/engine/furniture';
import { waysOut } from '../../src/plan/where';
import { distM } from '../../src/engine/position';
import { zoneById } from '../../src/engine/relations';
import { knownMap } from '../../src/ui/mapData';
import type { GameState } from '../../src/types';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const zoneOf = (s: GameState, name: string) => s.places.flatMap((p) => p.zones).find((z) => z.name === name);

it('FR2: zones get their kind\'s furniture, a layout zone its layout\'s, and the Weaver may replace a layout zone\'s list', () => {
  const s = toStoryStart(makeVillage());
  CONFIG.PLAN_CAPS = { ...CONFIG.PLAN_CAPS, places: 5 };
  const plan = villageStagePlan();
  plan.places.push({ key: 'inn', name: 'The Bent Nail', kind: 'place', parent: 'village', layout: LY.tavern, names: { common: 'Nail common room' },
    furniture: { kitchen: [{ kind: FU.table, name: 'bloodstained table' }] } });
  plan.zones.find((z) => z.key === 'street_door')!.ways.push({ to: 'inn.common', label: 'the inn, east', kind: 'door' });
  expect(validateStagePlan(s, plan, ctx)).toEqual([]);
  applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
  const own = (name: string) => s.furniture.filter((f) => f.zone === zoneOf(s, name)!.id).map((f) => f.name);
  expect(own('cellar')).toEqual(['barrels', 'sacks']); // a cellar's defaults
  const common = zoneOf(s, 'Nail common room')!;
  expect(own('Nail common room')).toContain('bar counter');
  expect(own('kitchen')).toEqual(['bloodstained table']);
  // FR4: the counter on the common room's north edge shows behind the counter too, on its south side
  const bar = s.places.flatMap((p) => p.zones).find((z) => waysOut(s, z.id).some((l) => l.to === common.id) && z.id.endsWith('bar'))!;
  const seen = furnitureIn(s, bar.id).find((f) => f.name === 'bar counter')!;
  expect(furnitureWhere(seen, common.id)).toBe('north side');
  expect(furnitureWhere(seen, bar.id)).toBe('south side');
});

it('FR1: a move can end beside a piece of furniture; the view lists it with where it stands; the map places it; an unknown kind counts as other', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const z = zoneById(s, 'tav_common')!;
  const fu = makeFurniture(s, z, [{ kind: FU.hearth, name: 'hearth', at: 'e' }, { kind: FU.table, name: 'table' }]);
  s.furniture = s.furniture.filter((f) => f.zone !== z.id).concat(fu);
  const pv = buildPlayerView(s);
  expect(pv.zone.furniture).toEqual([{ id: `${z.id}.fu1`, name: 'hearth', where: 'east side' }, { id: `${z.id}.fu2`, name: 'table', where: 'middle' }]);
  const go = intent({ move: { toZone: 'tav_common', spot: { near: `${z.id}.fu1` } } });
  const legal = checkParserLegality(go, pv);
  expect(legal.illegal).toEqual([]);
  play(s, { intent: legal.intent });
  const hearth = { zone: z.id, pos: furniturePos(s, z.id, fu[0]) };
  expect(distM(s, s.player, hearth)).toBeLessThan(1.5);
  const mz = knownMap(s).places.flatMap((p) => p.zones).find((m) => m.id === z.id)!;
  expect(mz.furniture?.map((f) => f.kind)).toEqual([FU.hearth, FU.table]);
  // an unknown kind counts as other
  expect(makeFurniture(s, z, [{ kind: 'FU999', name: 'loom' }])[0]).toMatchObject({ kind: FU.other, name: 'loom' });
});
