// BG-94: a tinker on alert called for help three turns late, in the middle of a calm talk, because the onAlert shout
// waited in the queue while his own agent spoke for him
import { describe, expect, it } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { alertOrders, updateAlarms } from '../../src/minds';
import type { GameEvent, GameState, Intent, NpcAction } from '../../src/types';
import { fakeView } from '../unit/minds-view';

const hold: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const act = (type: NpcAction['type']): NpcAction =>
  ({ type, target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: '' });
const turn = (s: GameState, orders: Record<string, NpcAction> = {}) => {
  s.turn += 1;
  const agentOutputs = Object.entries(orders).map(([actorId, action]) =>
    ({ agent: 'planner', actorId, output: { action, dialogue: null, gear: null, stance: null, planUpdate: null } }) as never);
  return resolveTurn(s, { intent: hold, aimed: false, agentOutputs, spokespeople: [] }, createRng(1));
};
const alarmed = (s: GameState) => {
  const g = actor(s, 'guard_1');
  g.mind!.routine = { id: 'guard_post', anchorTurn: 1, at: 420 };
  const e = { id: 'x', turn: s.turn, actorId: 'player', kind: 'attack', zone: 'gate_inner', effects: [], noise: 'normal', visibility: 'normal', perception: { guard_1: { level: 'full', cue: 'sight' } } } as unknown as GameEvent;
  updateAlarms(s, [e]);
  expect(g.mind!.alarm!.onAlertDue).toBe('guard_post');
  return g;
};
const shouts = (s: GameState) => s.events.filter((e) => e.actorId === 'guard_1' && e.kind === 'call_help');

describe('BG-94: the onAlert shout belongs to the moment of the alarm', () => {
  it('an actor whose own agent acts that turn has spent it', () => {
    const s = makeVillage();
    s.turn = 10;
    const g = alarmed(s);
    turn(s, { guard_1: act('hold') });
    expect(shouts(s)).toEqual([]);
    expect(g.mind!.alarm!.onAlertDue).toBeUndefined();
    turn(s);
    expect(shouts(s)).toEqual([]);
  });
  it('still fires the turn after the alarm when nothing else decides', () => {
    const s = makeVillage();
    s.turn = 10;
    alarmed(s);
    turn(s);
    expect(shouts(s)).toHaveLength(1);
  });
  it('a shout left over from an older alarm never fires', () => {
    const s = makeVillage();
    s.turn = 10;
    alarmed(s);
    s.turn = 13;
    expect(alertOrders(s, [fakeView(s, 'guard_1')])).toEqual([]);
  });
});
