import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('101 Fallback close in: one link along the shortest path, never into a frontier; in that zone, search', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const sl = place(s, 'slime_1', 'field_far');
  sl.mind!.knowledge.player = { status: 'suspicious', lastKnownZone: 'field_edge', lastSeenTurn: s.turn, source: 'heard', revealed: [] };
  expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'move', target: 'field_mid', source: 'fallback' });
  place(s, 'slime_1', 'field_mid');
  expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'move', target: 'field_edge' });
  place(s, 'slime_1', 'field_edge');
  expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'search', target: 'field_edge', source: 'fallback' });
  // never through the frontier link from the far side
  place(s, 'slime_1', 'field_far');
  sl.mind!.knowledge.player = { ...sl.mind!.knowledge.player, lastKnownZone: 'woods' };
  const o = fallbackOrder(buildActorView(s, 'slime_1'), createRng(1));
  expect(o.target).not.toBe('woods');
  expect(o.type).not.toBe('move');
});
