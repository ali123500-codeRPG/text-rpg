import { expect, it } from 'vitest';
import { makeVillage, actor, place, createRng } from '../harness';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { resolveTurn } from '../../src/engine';

it('102 Late Planner fights on: a significant engaged actor with no Planner output runs its combat list', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const g = place(s, 'guard_1', 'gate_inner');
  expect(g.mind!.control).toBe('agent');
  g.mind!.overrides = { player: 'opposed' };
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  expect(fallbackOrder(buildActorView(s, 'guard_1'), createRng(1))).toMatchObject({ type: 'attack', target: 'player', source: 'fallback' });
  // the Planner output is late: the turn resolves with no agent output for the guard
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(events.some((e) => e.actorId === 'guard_1' && e.kind === 'attack' && e.target === 'player')).toBe(true);
  expect(actor(s, 'guard_1').zone).toBe('gate_inner');
});
