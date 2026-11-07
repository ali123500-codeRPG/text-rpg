// 106 Opposed standoff (Ali, 07/11/2026): opposed means at odds but never striking first. An opposed guard who
// notices the player is alarmed but not engaged, so the turn stays Explore; only hostile attacks on sight.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { computePending } from '../../src/engine';
import { isEngaged } from '../../src/engine/relations';
import { intent, play } from './w4-kit';

it('106 Opposed standoff', () => {
  const s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
  const g = actor(s, 'guard_1');
  g.mind!.overrides = { player: 'opposed' };
  s.turn = 0;
  computePending(s);
  play(s, { intent: intent({ move: { toZone: 'gate_inner' } }) }); // the guard notices the player
  expect(g.mind!.knowledge.player?.status).not.toBe('unaware');
  expect(g.mind!.alarm?.armed).toBe(true); // wary: its alert fires
  expect(s.pending).toMatchObject({ mode: 'explore', engaged: [] }); // but no fight starts
  g.mind!.overrides = { player: 'hostile' };
  expect(isEngaged(s, g)).toBe(true);
});
