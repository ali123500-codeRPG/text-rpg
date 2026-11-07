// 49 Deed instead of a reply: an addressed Responder attacks instead of answering: no line is spoken,
// and the attack resolves at its own initiative.
import { afterEach, expect, it, vi } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { ruleset } from '../../src/ruleset';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play } from './w4-kit';

afterEach(() => vi.restoreAllMocks());

it('49 Deed instead of a reply', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  s.hidden.secrets.push({ id: 'cellar', holderId: 'trader', fact: 'smuggled goods in the cellar', leakTerms: ['smuggled'],
    revealWhen: { type: 'event_in_zone', kind: 'search', zone: 'tav_cellar' } });
  actor(s, 'trader').mind!.overrides = { player: 'opposed' };
  const i = intent({ action: { type: 'talk', skill: 'persuasion' }, spoken: 'What is in the cellar?', addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  expect(spokespeople).toEqual(['trader']);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  vi.spyOn(ruleset, 'initiative').mockImplementation((a) => (a.id === 'trader' ? 1 : 60));
  const reply = { agent: 'responder', actorId: 'trader',
    output: { action: act('attack', 'player'), dialogue: { line: 'Mind your business!', volume: 'shout' }, gear: null, stance: null, reveals: [], planUpdate: null } } as AcceptedAgentOutput;
  const ev = play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
  expect(ev[0]).toMatchObject({ actorId: 'player', kind: 'speak' });
  expect(ev.filter((e) => e.actorId === 'trader' && e.kind === 'speak')).toEqual([]);
  const deed = ev.findIndex((e) => e.actorId === 'trader');
  expect(ev[deed]).toMatchObject({ kind: 'attack', target: 'player', bark: true });
  expect(ev.slice(deed + 1).some((e) => e.actorId !== 'trader')).toBe(false); // lowest initiative: last
});
