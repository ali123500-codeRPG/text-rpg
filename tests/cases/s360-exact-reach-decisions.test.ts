// 360 Code consistency check IC12 a: CONFIG.REACH_MARGIN_M only soaks up a step's rounding when a blow lands. Decisions
// (close in first? is the attack ranged from here?) use the exact reach, and closing in aims the margin inside the reach,
// so a fighter always stops within it.
import { expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { closeInM, floorGap, M_EPS } from '../../src/engine/position';

const FIST_M = 0.7;
const room = () => {
  const s = makeVillage({ shape: { tav_common: { rect: { x: 0, y: 0, w: 20, d: 20 } } }, playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening;
  s.player.pos = { x: 0, y: 0 };
  return s;
};
const brawler = (s: GameState, x: number): Actor => {
  const a = s.actors.find((q) => q.id === 'patron_1')!;
  a.zone = 'tav_common'; a.placeId = s.player.placeId; a.pos = { x, y: 0 };
  a.mind!.control = 'agent'; (a.mind!.overrides ??= {}).player = 'hostile';
  return a;
};
const punch = (s: GameState, a: Actor): GameEvent[] =>
  play(s, { intent: intent(), agentOutputs: [plannerOut(a.id, act('attack', 'player', { skill: SK.unarmed_strike, item: 'unarmed' }))] });
const kinds = (ev: GameEvent[], id: string) => ev.filter((e) => e.actorId === id).map((e) => e.kind);

it('closing in from 3 m stops inside the exact reach, a margin short of it, and strikes the same turn', () => {
  const s = room();
  const a = brawler(s, 3);
  const ev = punch(s, a);
  expect(kinds(ev, a.id)).toEqual(['move', 'attack']);
  expect(floorGap(s, a, s.player)).toBeLessThanOrEqual(closeInM(FIST_M) + M_EPS); // SZ5: between their bodies
});

it('a foe a hair past the exact reach is closed in on first, not struck from where the fighter stands', () => {
  const s = room();
  const a = brawler(s, 3);
  a.pos!.x += FIST_M + CONFIG.REACH_MARGIN_M / 2 - floorGap(s, a, s.player); // SZ5: that far between their bodies
  const ev = punch(s, a);
  expect(kinds(ev, a.id)[0]).toBe('move'); // it steps in before the first blow
  expect(kinds(ev, a.id)).toContain('attack');
  expect(floorGap(s, a, s.player)).toBeLessThanOrEqual(FIST_M);
});
