// 358 Code consistency check. BG-274 (IC8 a): a Look around showed people out to a plain 25 m but searched out to 25.1 m
// (withinM); both now use one check, inLookReach. BG-276 (IC10 a): the Parser's answer shape left out the way ops open and
// shut; one WAY_OPS list now feeds the shape, the schema and the engine.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { beside, makeVillage } from '../harness';
import { inLookReach, lookAround } from '../../src/perception';
import { seeingM } from '../../src/engine/position';
import { PARSER_SHAPE } from '../../src/agents/prompts';
import { WAY_OPS } from '../../src/engine/barriers';

it('BG-274: someone in plain sight a hair past the look range is shown by a look', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const edge = CONFIG.SIGHT_M.normal![0] + CONFIG.REACH_MARGIN_M / 2;
  s.player.pos = { x: 92, y: -14 }; // the field's west side, so the guard stands 25.05 m east inside it
  beside(s, 'guard_1', 'player', edge);
  expect(seeingM(s, s.player, s.actors.find((a) => a.id === 'guard_1')!)).toBeCloseTo(edge, 6);
  expect(inLookReach(edge)).toBe(true);
  expect(lookAround(s)).toContain('guard_1');
});

it("BG-276: the Parser's shape names every way op", () => {
  const way = PARSER_SHAPE.split('\n').find((l) => l.includes('"way"'))!;
  for (const op of WAY_OPS) expect(way).toContain(`"${op}"`);
});
