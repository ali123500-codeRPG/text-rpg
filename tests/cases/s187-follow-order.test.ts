// 187 BG-34 follow order: any NPC's agent may switch it to the follow routine when it agrees to come along with the player
// (whatever its routine set). It then walks after the player every turn: code-run turns by the routine, agent-run turns
// beside whatever action the agent gave, until the agent switches back to one of its own routines. Bandmates never take it.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildActorView } from '../../src/views';
import { routineAllowed } from '../../src/agents/legality';
import { switchRoutine } from '../../src/minds/state';
import { FOLLOW_ROUTINE } from '../../src/minds';
import type { TurnInput } from '../../src/engine';

const setup = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  const p = actor(s, 'patron_1');
  p.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  p.mind!.control = 'agent';
  return s;
};
const planner = (routine: string | null, action: Record<string, unknown> = { type: 'idle' }) => ({
  agentOutputs: [{ agent: 'planner', actorId: 'patron_1', output: { action, dialogue: null, gear: null, stance: null, planUpdate: routine === null ? null : { goal: 'walk with the stranger', steps: [], triggers: [], routine } } }],
}) as unknown as Partial<TurnInput>;
const sees = (s: GameState, zone: string) => Object.assign(actor(s, 'patron_1').mind!.knowledge.player!, { lastKnownZone: zone, lastSeenTurn: s.turn });

describe('187 follow order (BG-34)', () => {
  it('follow is offered to every NPC agent, and only the agent may switch to it', () => {
    const s = setup();
    const p = actor(s, 'patron_1');
    expect(p.mind!.routines).not.toContain(FOLLOW_ROUTINE);
    expect(routineAllowed(buildActorView(s, 'patron_1'), FOLLOW_ROUTINE)).toBe(true);
    expect(switchRoutine(s, p, FOLLOW_ROUTINE, 'bandmate')).toBe(false);
    expect(switchRoutine(s, p, FOLLOW_ROUTINE, 'agent')).toBe(true);
    expect(p.mind!.routine!.id).toBe(FOLLOW_ROUTINE);
  });
  it('an agent that agrees to come along walks after the player, on its own turns and the agent\'s', () => {
    const s = setup();
    play(s, { intent: intent({}), ...planner(FOLLOW_ROUTINE, { type: 'talk', target: 'player', intent: 'agree' }) });
    expect(actor(s, 'patron_1').mind!.routine!.id).toBe(FOLLOW_ROUTINE);
    // the player steps out; on an agent-run turn the follower walks after them beside its own action
    play(s, { intent: intent({ move: { toZone: 'street_door' } }) });
    sees(s, 'street_door');
    play(s, { intent: intent({}), ...planner(null) });
    expect(actor(s, 'patron_1').zone).toBe('street_door');
    // on a code-run turn the routine walks after them
    play(s, { intent: intent({ move: { toZone: 'street_square' } }) });
    sees(s, 'street_square');
    play(s, { intent: intent({}) });
    expect(actor(s, 'patron_1').zone).toBe('street_square');
  });
  it('switching back to its own routine ends it', () => {
    const s = setup();
    play(s, { intent: intent({}), ...planner(FOLLOW_ROUTINE) });
    play(s, { intent: intent({}), ...planner('drink_at_seat') });
    expect(actor(s, 'patron_1').mind!.routine!.id).toBe('drink_at_seat');
  });
});
