// 60 Secret slips [Proposed]: a persuade check that meets a check_passed reveal sets SLIPS; the secret is revealed.
// (The Narrator's leak scan is the pipeline's half of this test.)
import { expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

it('60 Secret slips', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  s.hidden.secrets.push({ id: 'informant', holderId: 'trader', fact: 'the captain is the informant', leakTerms: ['informant'],
    revealWhen: { type: 'check_passed', skill: SK.persuasion, minTier: 'success', againstActorId: 'trader' } });
  const i = intent({ action: { type: 'persuade', skill: SK.persuasion }, spoken: 'Who sold us out?', addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  // natural 00 for the player, natural 01 for the trader
  const exchange = resolveSpeech(s, i, spokespeople, forcedRng([100, 1]));
  expect(exchange.perSpokesperson.trader.contest.winner).toBe('a');
  expect(exchange.perSpokesperson.trader.slips).toEqual(['informant']);
  const reply = { agent: 'responder', actorId: 'trader',
    output: { action: act('talk', 'player'), dialogue: { line: 'It... it was the captain.', volume: 'whisper' }, gear: null, stance: null, reveals: [], planUpdate: null } } as AcceptedAgentOutput;
  play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
  expect(s.player.journal!.secretsKnown).toEqual(['informant']);
});
