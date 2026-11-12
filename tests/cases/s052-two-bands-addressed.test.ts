// 52 Two bands addressed: two spokesperson calls, each with its own contest and impression; replies resolve in initiative order.
import { afterEach, expect, it, vi } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

afterEach(() => vi.restoreAllMocks());

it('52 Two bands addressed', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  place(s, 'guard_1', 'tav_counter');
  const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken: 'Has anyone seen the slimes?', addressees: ['trader', 'guard_1'] });
  const spokespeople = selectSpokespeople(s, i);
  expect(spokespeople).toEqual(['trader', 'guard_1']);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(5));
  expect(Object.keys(exchange.perSpokesperson).sort()).toEqual(['guard_1', 'trader']);
  expect(exchange.impression).toEqual(expect.any(String));
  vi.spyOn(ruleset, 'initiative').mockImplementation((a) => ({ guard_1: 90, trader: 20 })[a.id] ?? 50);
  const voice = (actorId: string, line: string) =>
    ({ agent: 'voice', actorId, output: { action: act('talk', 'player'), line, volume: 'normal', shares: [], gear: null, stance: null, routine: null } }) as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople, exchange, agentOutputs: [voice('trader', 'Out past the gate.'), voice('guard_1', 'Every night.')] });
  expect(ev.slice(0, 3).map((e) => [e.actorId, e.kind])).toEqual([['player', 'speak'], ['guard_1', 'speak'], ['trader', 'speak']]);
});
