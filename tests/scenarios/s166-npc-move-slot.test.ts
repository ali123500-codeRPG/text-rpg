// 166 NPC move slot (Q2): a Planner or Responder gives a move beside its action, as the player does. Talk then move, move
// then talk (the line is said from where the move ends), and a dash: hold with a move goes two zones.
import { expect, it } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import type { NpcMove } from '../../src/types';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

function turn(type: 'talk' | 'hold' | 'move', move: NpcMove, target: string | null = type === 'talk' ? 'player' : null) {
  const s = makeVillage({ playerZone: 'tav_common' });
  const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken: 'A word?', addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  const reply = { agent: 'responder', actorId: 'trader',
    output: { action: act(type, target), move, dialogue: { line: 'Later.', volume: 'normal' }, gear: null, stance: null, reveals: [], planUpdate: null } } as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
  return { zone: actor(s, 'trader').zone, mine: ev.filter((e) => e.actorId === 'trader').map((e) => `${e.kind}@${e.zone}`) };
}

it('166 an NPC moves beside its reply, before or after it, and dashes with hold', () => {
  expect(turn('talk', { toZone: 'tav_cellar', after: true })).toEqual({ zone: 'tav_cellar', mine: ['speak@tav_counter', 'move@tav_cellar'] });
  expect(turn('talk', { toZone: 'tav_common' })).toEqual({ zone: 'tav_common', mine: ['move@tav_common', 'speak@tav_common'] });
  expect(turn('hold', { toZone: 'street_door' }).zone).toBe('street_door');
  // an action that is itself a move keeps only that one move
  expect(turn('move', { toZone: 'street_door' }, 'tav_common').zone).toBe('tav_common');
});
