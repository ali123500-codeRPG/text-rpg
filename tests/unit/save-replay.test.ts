import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { ReplayRefused, replayTurn, type ReplayDeps } from '../../src/save/replay';
import type { AgentTurnLog, GameEvent, TurnRecord } from '../../src/types';

const log = (agent: AgentTurnLog['agent'], actorId: string | undefined, output: unknown, status: AgentTurnLog['status'] = 'ok'): AgentTurnLog =>
  ({ turn: 1, agent, actorId, input: 'view', output, status, errors: [] });
const ev = (actorId: string, kind: string, zone = ''): GameEvent => ({ id: 'e', turn: 1, actorId, kind, zone, effects: [], noise: 'silent', visibility: 'unseen', perception: {} });

describe('replayTurn', () => {
  const s = makeVillage();
  const record: TurnRecord = {
    storyId: 'test', turn: 1, libraryVersion: 1, rngBefore: 777, playerInput: 'ignored', events: [], factsAdded: [], aimed: true,
    agentLog: [
      log('parser', undefined, { move: null, action: null }),
      log('planner', 'slime_1', { p: 's' }),
      log('planner', 'guard_1', { p: 'g' }),
      log('planner', 'trader', { p: 't' }, 'late'),
      log('narrator', undefined, { text: 'x' }),
    ],
  };
  const deps: ReplayDeps = {
    libraryVersion: 1,
    resolveTurn: (_st, input, rng) => [ev(input.agentOutputs.map((o) => o.actorId).join(','), String(rng.d100()), input.aimed ? 'aimed' : '')],
  };

  it('feeds logged outputs in actor-id order from rngBefore', () => {
    const a = replayTurn(s, record, deps);
    expect(replayTurn(s, record, deps).events).toEqual(a.events);
    expect(a.events[0].actorId).toBe('guard_1,slime_1'); // the late output was never used
    expect(a.events[0].zone).toBe('aimed');
    expect(a.state).not.toBe(s);
  });
  it('refuses under another library version', () => {
    expect(() => replayTurn(s, record, { ...deps, libraryVersion: 2 })).toThrow(ReplayRefused);
  });
  it('a scene start replays through the director', () => {
    const scene = { ...record, eventRoll: { actorId: 'player', roll: 50, tier: 'success' as const, modifiers: [] } };
    expect(() => replayTurn(s, scene, deps)).toThrow(/scene director/);
    const r = replayTurn(s, scene, { ...deps, replaySceneStart: (_st, rec) => [ev(String(rec.eventRoll!.tier), 'arrival')] });
    expect(r.events.map((e) => e.kind)).toEqual([expect.any(String), 'arrival']);
  });
});
