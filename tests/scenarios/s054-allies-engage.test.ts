// 54 Allies engage: guards opposed to bandits engage them without the player present; the turn is Tactical
// and the guards are engaged (the pipeline gives engaged significant actors Planner calls).
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { computePending } from '../../src/engine';
import { act, play, plannerOut } from './w4-kit';

it('54 Allies engage', () => {
  const s = makeVillage({ playerZone: 'tav_cellar' });
  s.bands.push({ id: 'bandits', name: 'bandits', goals: '', temperament: '', tactics: 'simple', lethal: true, relations: { village_watch: 'opposed' } });
  s.bands.find((b) => b.id === 'village_watch')!.relations.bandits = 'opposed';
  s.actors.push(spawnNpc(s, 'guard', { id: 'bandit_1', zone: 'gate_inner', placeId: 'gate', bandId: 'bandits', name: 'Rook', storyId: s.storyId }));
  actor(s, 'guard_1').mind!.knowledge.bandit_1 = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: 1, source: 'seen', revealed: [] };
  s.turn = 0;
  const p = computePending(s);
  expect(p.mode).toBe('tactical');
  expect(p.engaged).toContain('guard_1');
  expect(actor(s, 'guard_1').mind!.control).toBe('agent');
  const ev = play(s, { agentOutputs: [plannerOut('guard_1', act('attack', 'bandit_1', { skill: 'melee_medium' }))] });
  expect(ev.find((e) => e.actorId === 'guard_1')).toMatchObject({ kind: 'attack', target: 'bandit_1' });
});
