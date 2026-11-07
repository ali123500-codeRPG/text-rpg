import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, actor, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { detectPlayer, installRoutines, routineOrder } from '../../src/minds';
import { updateBeliefs } from '../../src/perception';
import { buildActorView } from '../../src/views';
import { computePending } from '../../src/engine';

it('20 Detection is individual: guard 2 stays unaware and on its routine until told', () => {
  const s = makeVillage({ playerZone: 'street_square' });
  s.bands.find((b) => b.id === 'village_watch')!.relations.player_band = 'hostile';
  const g2 = spawnNpc(null, 'guard', { id: 'guard_2', zone: 'tav_cellar', placeId: 'tavern', bandId: 'village_watch' });
  installRoutines(g2, 'gate_guard', { post: 'tav_cellar' }, undefined, s.turn, createRng(4));
  s.actors.push(g2);
  const seen: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'player', kind: 'interact', zone: 'street_square', effects: [], noise: 1, visibility: 2,
    perception: { guard_1: { level: 'full', cue: 'sight' } },
  };
  detectPlayer(s, seen, createRng(1));
  expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
  expect(g2.mind!.knowledge.player?.status ?? 'unaware').toBe('unaware');
  expect(routineOrder(buildActorView(s, 'guard_2')).source).toBe('routine');
  let pending = computePending(s);
  expect(pending.engaged).toContain('guard_1');
  expect(pending.engaged).not.toContain('guard_2');
  // guard 1 shouts for help; guard 2 hears it
  const shout: GameEvent = {
    id: 'ev_2', turn: s.turn, actorId: 'guard_1', kind: 'call_help', zone: 'gate_inner', effects: [], noise: 3, visibility: 2,
    line: { text: 'To me!', volume: 'shout' }, perception: { guard_2: { level: 'partial', cue: 'sound' } },
  };
  updateBeliefs(s, { kind: 'event', event: shout });
  expect(g2.mind!.knowledge.player).toMatchObject({ status: 'suspicious', source: 'told' });
  pending = computePending(s);
  expect(pending.engaged).toContain('guard_2');
});
