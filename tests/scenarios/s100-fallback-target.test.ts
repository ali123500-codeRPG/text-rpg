import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { installRoutines, fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';

it('100 Fallback target: the companion that hit it last turn is attacked, even with the player there', () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const c = spawnNpc(null, 'patron', { id: 'comp', zone: 'field_mid', placeId: 'field', bandId: 'player_band', name: 'Pip' });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  const sl = actor(s, 'slime_1');
  const b = (zone: string) => ({ status: 'aware' as const, lastKnownZone: zone, lastSeenTurn: s.turn, source: 'seen' as const, revealed: [] });
  sl.mind!.knowledge.player = b('field_mid');
  sl.mind!.knowledge.comp = b('field_mid');
  // last turn the companion hit the slime
  const hit: GameEvent = { id: 'ev_1', turn: s.turn, actorId: 'comp', kind: 'attack', zone: 'field_mid', target: 'slime_1', effects: [], noise: 'normal', visibility: 'normal', perception: { slime_1: { level: 'full', cue: 'sight' } } };
  s.events.push(hit);
  s.scratch = { slime_1: ['comp'] };
  s.turn += 1;
  const view = buildActorView(s, 'slime_1');
  expect(view.self.lastHitBy).toBe('comp');
  expect(fallbackOrder(view, createRng(1))).toMatchObject({ type: 'attack', target: 'comp', source: 'fallback' });
});
