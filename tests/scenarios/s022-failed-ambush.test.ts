import { afterEach, expect, it, vi } from 'vitest';
import type { GameEvent, RollRequest } from '../../src/types';
import { makeVillage, actor, place, createRng } from '../harness';
import { resolveAmbush, alertOrders } from '../../src/minds';
import { ruleset } from '../../src/ruleset';
import { buildActorView } from '../../src/views';
import { computePending } from '../../src/engine';

afterEach(() => vi.restoreAllMocks());

it('22 Failed ambush: aware before the blow, onAlert this turn, Planner next turn', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  s.bands.find((b) => b.id === 'village_watch')!.relations.player_band = 'opposed';
  place(s, 'guard_1', 'gate_inner');
  const tiers: Record<string, number> = { player: -2, guard_1: 1 };
  vi.spyOn(ruleset, 'roll').mockImplementation((req: RollRequest) => ({ actorId: req.actorId, skill: req.skill, d100: 50, margin: 0, tier: tiers[req.actorId] ?? -3, natural: 0, modifiers: [], tierShifts: [] }));
  const attack: GameEvent = {
    id: 'ev_1', turn: s.turn, actorId: 'player', kind: 'attack', zone: 'gate_inner', target: 'guard_1', itemId: 'player_arming_sword_1',
    effects: [], noise: 2, visibility: 2, perception: { guard_1: { level: 'full', cue: 'sight' } },
  };
  expect(resolveAmbush(s, 'player', 'guard_1', attack, createRng(1)).surprised).toBe(false);
  expect(actor(s, 'guard_1').mind!.knowledge.player.status).toBe('aware');
  const orders = alertOrders(s, [buildActorView(s, 'guard_1')]);
  expect(orders).toEqual([expect.objectContaining({ actorId: 'guard_1', source: 'onAlert', type: 'call_help' })]);
  // next turn: no second onAlert, and the guard is engaged (Planner call)
  s.turn += 1;
  expect(alertOrders(s, [buildActorView(s, 'guard_1')])).toEqual([]);
  expect(computePending(s).engaged).toContain('guard_1');
});
