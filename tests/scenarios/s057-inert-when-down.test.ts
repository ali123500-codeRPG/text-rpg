// 57 Inert when down: an incapacitated guard gets no order, its ambush trigger doesn't fire, it isn't engaged,
// and addressing it makes no dialogue call.
import { expect, it } from 'vitest';
import { actor, makeVillage, place } from '../harness';
import { computePending, selectSpokespeople } from '../../src/engine';
import { act, intent, play, plannerOut } from './w4-kit';

it('57 Inert when down', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const g = actor(s, 'guard_1');
  place(s, 'slime_1', 'gate_inner');
  g.mind!.knowledge.slime_1 = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: 1, source: 'seen', revealed: [] };
  g.core.condition.hpLostPct = 100;
  s.hidden.plans.guard_1 = { goal: 'ambush', steps: [], createdTurn: 0, triggers: [
    { id: 'amb', ownerId: 'guard_1', when: { type: 'turn_reached', turn: 1 }, then: { type: 'attack', target: '$player', skill: 'melee_medium', intent: 'ambush' }, once: true },
  ] };
  s.turn = 0;
  const p = computePending(s);
  expect(p.fired).toEqual([]);
  expect(p.engaged).not.toContain('guard_1');
  expect(s.hidden.plans.guard_1.triggers).toHaveLength(1); // still armed
  expect(selectSpokespeople(s, intent({ action: { type: 'talk' }, spoken: 'Are you alright?', addressees: ['guard_1'] }))).toEqual([]);
  const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('attack', 'slime_1'))] });
  expect(ev.filter((e) => e.actorId === 'guard_1')).toEqual([]);
});
