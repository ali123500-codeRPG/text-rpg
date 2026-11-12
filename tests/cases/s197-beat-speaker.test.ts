// BG-50: a talk beat at the player takes its line from the Responder call; with no line it speaks no empty line.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { usableAgentOutputs } from '../../src/engine/merge';
import type { AcceptedAgentOutput, TurnInput } from '../../src/engine';
import { act, intent, play } from './w4-kit';

const out = (agent: 'responder' | 'planner', line?: string) => ({ agent, actorId: 'trader',
  output: { action: act('talk', 'player'), ...(line ? { dialogue: { line, volume: 'normal' } } : {}), gear: null, stance: null, reveals: [], planUpdate: null } }) as AcceptedAgentOutput;

it('BG-50: a beat speaker counts its Responder output, not its Planner', () => {
  const input = { intent: null, spokespeople: [], beatSpeakers: ['trader'], agentOutputs: [out('planner'), out('responder', 'Fancy a bout?')] } as unknown as TurnInput;
  expect(usableAgentOutputs(input).map((o) => o.agent)).toEqual(['responder']);
  const plain = { ...input, beatSpeakers: undefined } as unknown as TurnInput;
  expect(usableAgentOutputs(plain).map((o) => o.agent)).toEqual(['planner']);
});

it('BG-50: a talk with no words speaks no empty line', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  const ev = play(s, { intent: intent(), spokespeople: [], agentOutputs: [out('planner')] });
  const sp = ev.filter((e) => e.actorId === 'trader' && e.kind === 'speak');
  expect(sp.length).toBeGreaterThan(0);
  for (const e of sp) expect((e as { line?: unknown }).line).toBeUndefined();
});
