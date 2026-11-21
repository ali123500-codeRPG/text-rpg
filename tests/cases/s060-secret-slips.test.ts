// 60 Secret slips: a persuade check that wins the contest at the reveal's minTier or better meets a check_passed reveal sets SLIPS; the secret is revealed.
// (The Narrator's leak scan is the pipeline's half of this test.)
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { slipsFor } from '../../src/engine/speech';
import type { ContestResult, RollResult } from '../../src/types/ruleset';
import { SK } from '../../src/library/skillIds';

it('60 Secret slips: a slip needs the contest won; a high tier that still loses gives none', () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  s.hidden.secrets.push({ id: 'informant', holderId: 'trader', fact: 'the captain is the informant', leakTerms: ['informant'],
    revealWhen: { type: 'check_passed', skill: SK.persuasion, minTier: 'success', againstActorId: 'trader' } });
  const roll = (actorId: string, tier: RollResult['tier']): RollResult => ({ actorId, skill: SK.persuasion, d100: 80, margin: 10, tier, natural: 0, modifiers: [], tierShifts: [] });
  const contest = (winner: ContestResult['winner'], tier: RollResult['tier']): ContestResult => ({ a: roll('player', tier), b: roll('trader', 'critical_success'), gap: 1, winner });
  expect(slipsFor(s, 'trader', [SK.persuasion], contest('a', 'great_success'))).toEqual(['informant']);
  expect(slipsFor(s, 'trader', [SK.persuasion], contest('b', 'great_success'))).toEqual([]);
  expect(slipsFor(s, 'trader', [SK.persuasion], contest('tie', 'great_success'))).toEqual([]);
  expect(slipsFor(s, 'trader', [SK.persuasion], contest('a', 'near_miss'))).toEqual([]);
});
