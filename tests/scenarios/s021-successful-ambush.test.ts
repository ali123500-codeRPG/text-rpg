import type { Tier } from '../../src/types';
import { afterEach, expect, it, vi } from 'vitest';
import type { GameEvent, RollRequest } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { resolveAmbush, alertOrders, routineOrder } from '../../src/minds';
import { ruleset } from '../../src/ruleset';
import { buildActorView } from '../../src/views';
import { computePending } from '../../src/engine';
import { isEngaged } from '../../src/engine/relations';

afterEach(() => vi.restoreAllMocks());

it('21 Successful ambush: the target keeps its routine order; next turn only engaged actors get Planner calls', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  place(s, 'guard_1', 'gate_inner');
  const tiers: Record<string, Tier> = { player: 'critical_success', guard_1: 'failure' };
  vi.spyOn(ruleset, 'roll').mockImplementation((req: RollRequest) => ({ actorId: req.actorId, skill: req.skill, d100: 50, margin: 0, tier: tiers[req.actorId] ?? 'critical_failure', natural: 0, modifiers: [], tierShifts: [] }));
  const attack: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'player', kind: 'attack', zone: 'gate_inner', target: 'guard_1', itemId: 'player_arming_sword_1',
    effects: [], noise: 2, visibility: 2, perception: { guard_1: { level: 'full', cue: 'sight' } },
  };
  expect(resolveAmbush(s, 'player', 'guard_1', attack, createRng(1)).surprised).toBe(true);
  expect(actor(s, 'guard_1').mind!.knowledge.player?.status ?? 'unaware').toBe('unaware');
  const view = buildActorView(s, 'guard_1');
  expect(alertOrders(s, [view])).toEqual([]);
  expect(routineOrder(view).source).toBe('routine');
  const pending = computePending(s);
  for (const id of pending.engaged) expect(isEngaged(s, actor(s, id))).toBe(true);
});
