// BG-180 (run 79g t44-47): Ness told the player she was off to fetch rags from her chest, walked there, then stood silent
// two turns: Planner calls went only to engaged actors and deal parties, so an NPC acted again only when spoken to. One
// rule: an answer with a deed under way gives that NPC Planner calls for ERRAND_TURNS turns, code-run or not; its hold ends it.
import { expect, it } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { act, intent, play, plannerOut } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { plannerActors } from '../../src/agents/game';
import { CONFIG } from '../../src/config';

it('an NPC that answers with an errand keeps thinking until it holds', () => {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2', 'guard_1'] });
  expect(actor(s, 'trader').mind!.control).toBe('code');
  const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken: 'Can you fetch me something from the cellar?', addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  const reply = { agent: 'responder', actorId: 'trader',
    output: { action: act('move', 'tav_cellar'), dialogue: { line: 'I will fetch it.', volume: 'normal' }, gear: null, stance: null, reveals: [], planUpdate: null } } as AcceptedAgentOutput;
  play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
  expect(plannerActors(s)).toContain('trader');
  play(s, { intent: intent(), agentOutputs: [plannerOut('trader', act('hold'))] });
  expect(plannerActors(s)).not.toContain('trader');
  expect(CONFIG.ERRAND_TURNS).toBeGreaterThan(0);
});
