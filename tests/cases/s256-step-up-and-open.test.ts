// BG-172 (run 98c t28): "I open the side gate and check behind it": 1 m from the gate, the step up to it took the move slot
// and opening it then had none left, so it came to nothing while the search went on. One rule: a step up to a way (a step,
// ENTER_M, at most) is part of working it, so the op still has the move slot.
import { expect, it } from 'vitest';
import type { Barrier } from '../../src/types';
import { byDoor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';
import { BK } from '../../src/library/tableIds';

it('a step to a gate, opening it and searching all fit one turn', () => {
  const s = makeVillage({ playerZone: 'street_door', without: ['slime_1', 'slime_2', 'guard_1'] });
  const bar: Barrier = { id: 'side_gate', kind: BK.gate, grade: 'minor' };
  (s.barriers ??= {})[bar.id] = bar;
  zoneById(s, 'street_door')!.links.find((l) => l.to === 'tav_common')!.barrier = bar.id;
  zoneById(s, 'tav_common')!.links.find((l) => l.to === 'street_door')!.barrier = bar.id;
  byDoor(s, 'player', 'street_door', 'tav_common', 1);
  const ev = play(s, { intent: intent({ way: { toZone: 'tav_common', op: 'open' }, action: { type: 'search' } }) });
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'wasted')).toBe(false);
  expect(s.barriers!.side_gate.open).toBe(true);
  expect(ev.some((e) => e.actorId === 'player' && e.kind === 'search')).toBe(true);
});
