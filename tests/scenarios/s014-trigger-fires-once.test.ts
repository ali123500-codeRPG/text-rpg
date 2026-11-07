// 14 Trigger fires once: a once trigger whose condition holds at turn start and mid-turn fires exactly once.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { computePending } from '../../src/engine';
import { play } from './w4-kit';

it('14 Trigger fires once', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  s.turn = 0;
  actor(s, 'guard_1').mind!.knowledge.player = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: 0, source: 'seen', revealed: [] };
  s.hidden.plans.guard_1 = { goal: 'watch the gate', steps: [], createdTurn: 0, triggers: [
    { id: 'shout', ownerId: 'guard_1', when: { type: 'player_seen_in_zone', zone: 'gate_inner' }, then: { type: 'call_help', target: null, skill: null, intent: 'raise the watch' }, once: true },
  ] };
  expect(computePending(s).fired).toEqual(['shout']);
  play(s); // the player is still seen at the gate, mid-turn and at the next turn start
  play(s);
  expect(s.hidden.firedLog.filter((f) => f.triggerId === 'shout')).toHaveLength(1);
});
