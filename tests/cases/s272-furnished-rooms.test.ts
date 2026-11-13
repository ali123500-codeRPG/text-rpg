// 272 FR1–FR5 (Speech with actions, furnished rooms): a zone lists named furniture with where it stands. Its kind gives
// defaults, a layout its own, and the Weaver may replace either (FR2). A move can end beside a piece (spot near its id).
// A piece on an edge (the bar counter) is one record and shows on both sides (FR4). The views and the map list it (FR5).
import { expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { FU, LY } from '../../src/library/tableIds';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { furnitureIn, furniturePos, makeFurniture } from '../../src/engine/furniture';
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
  plan.zones.find((z) => z.key === 'street_door')!.links.push({ to: 'inn.common', label: 'the inn, east', sight: false });
  expect(validateStagePlan(s, plan, ctx)).toEqual([]);
  applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
  expect(zoneOf(s, 'cellar')!.furniture?.map((f) => f.name)).toEqual(['barrels', 'sacks']); // a cellar's defaults
  const common = zoneOf(s, 'Nail common room')!;
  expect(common.furniture?.map((f) => f.name)).toContain('bar counter');
  expect(zoneOf(s, 'kitchen')!.furniture?.map((f) => f.name)).toEqual(['bloodstained table']);
  // FR4: the counter on the common room's north edge shows behind the counter too, on its south side
  const bar = s.places.flatMap((p) => p.zones).find((z) => z.links.some((l) => l.to === common.id) && z.id.endsWith('bar'))!;
  const seen = furnitureIn(s, bar.id).find((f) => f.name === 'bar counter');
  expect(seen?.at).toBe('s');
});

it('FR1: a move can end beside a piece of furniture; the view lists it with where it stands; the map places it', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const z = zoneById(s, 'tav_common')!;
  z.furniture = makeFurniture(z.id, [{ kind: FU.hearth, name: 'hearth', at: 'e' }, { kind: FU.table, name: 'table' }]);
  const pv = buildPlayerView(s);
  expect(pv.zone.furniture).toEqual([{ id: `${z.id}.fu1`, name: 'hearth', where: 'east side' }, { id: `${z.id}.fu2`, name: 'table', where: 'middle' }]);
  const go = intent({ move: { toZone: 'tav_common', spot: { near: `${z.id}.fu1` } } });
  const legal = checkParserLegality(go, pv);
  expect(legal.illegal).toEqual([]);
  play(s, { intent: legal.intent });
  const hearth = { zone: z.id, pos: furniturePos(s, z.id, z.furniture[0])! };
  expect(distM(s, s.player, hearth)).toBeLessThan(1.5);
  const mz = knownMap(s).places.flatMap((p) => p.zones).find((m) => m.id === z.id)!;
  expect(mz.furniture?.map((f) => f.kind)).toEqual([FU.hearth, FU.table]);
});

it('FR1: an unknown kind counts as other; a piece with no side stands in the middle', () => {
  makeVillage();
  const [f] = makeFurniture('z', [{ kind: 'FU999', name: 'loom' }]);
  expect(f).toEqual({ id: 'z.fu1', kind: FU.other, name: 'loom' });
});

it('whole turn: the Narrator sees the room\'s furniture', async () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const z = zoneById(g.game.state()!, 'tav_common')!;
  z.furniture = makeFurniture(z.id, [{ kind: FU.hearth, name: 'smoky hearth', at: 'e' }]);
  await g.turn(intent({ action: { type: 'wait' } }));
  const req = g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] };
  expect(req.input[1].content).toContain('smoky hearth');
});
