// BG-50: a talk beat at the player takes its line from the Responder call; with no line it speaks no empty line.
import { expect, it } from 'vitest';
import { usableAgentOutputs } from '../../src/engine/merge';
import type { AcceptedAgentOutput, TurnInput } from '../../src/engine';
import { act } from './w4-kit';

const out = (agent: 'responder' | 'planner', line?: string) => ({ agent, actorId: 'trader',
  output: { action: act('talk', 'player'), ...(line ? { dialogue: { line, volume: 'normal' } } : {}), gear: null, stance: null, reveals: [], planUpdate: null } }) as AcceptedAgentOutput;

it('BG-50: a beat speaker counts its Responder output, not its Planner', () => {
  const input = { intent: null, spokespeople: [], beatSpeakers: ['trader'], agentOutputs: [out('planner'), out('responder', 'Fancy a bout?')] } as unknown as TurnInput;
  expect(usableAgentOutputs(input).map((o) => o.agent)).toEqual(['responder']);
  const plain = { ...input, beatSpeakers: undefined } as unknown as TurnInput;
  expect(usableAgentOutputs(plain).map((o) => o.agent)).toEqual(['planner']);
});

