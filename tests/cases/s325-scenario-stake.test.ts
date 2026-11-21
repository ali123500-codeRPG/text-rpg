// 325 SW8 (SW1 b, SW2 a): every scenario, at every tier, has a real conflict. A new scenario's plan names its stake (hidden:
// what is lost if the player does nothing); a plan without one gets a repair error. The stake is kept on the scenario and
// shown to the Weaver at its check-ins, and a check-in may change it. Great Success needs a real challenge (moderate to
// major) with a gain one or two steps above it.
import { describe, expect, it } from 'vitest';
import type { CheckinAnswer, GameState, PlanEnding } from '../../src/types';
import type { PlanContext } from '../../src/scenario';
import { createRng, makeVillage } from '../harness';
import { applyCheckin, frameOf } from '../../src/engine/scenarioEnd';
import { applyCheckinPlan, checkinPlanErrors } from '../../src/scenario/checkin';
import { validateStagePlan } from '../../src/scenario/validate';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { checkCheckin } from '../../src/agents/schema';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const running = (stake?: string) => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  s.stage.scenario = frameOf(s, { question: 'q', ...(stake ? { stake } : {}), scale: 'situation', endings: judged }, 'success', (_k, r) => r);
  return s;
};
const go = (s: GameState, a: CheckinAnswer) => applyCheckin(s, s.stage.scenario!.number, a, [], { errors: (x) => checkinPlanErrors(s, x), apply: (x) => applyCheckinPlan(s, x, createRng(2)) });

describe('325 a scenario names its stake (SW8)', () => {
  it('a new scenario with no stake, or a blank one, gets a repair error; with one it is clean', () => {
    const p = villageStagePlan(), s = toStoryStart(makeVillage()); // validation reads the state, never changes it
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    delete p.scenario!.stake;
    expect(validateStagePlan(s, p, ctx).map((e) => e.code)).toContain('scenario_stake');
    p.scenario!.stake = '  ';
    expect(validateStagePlan(s, p, ctx).map((e) => e.code)).toContain('scenario_stake');
  });
  it('a check-in may change the stake; one that changes only the question keeps it', () => {
    const s = running('the field');
    go(s, { verdict: 'continue', change: { question: 'q2' } });
    expect(s.stage.scenario).toMatchObject({ question: 'q2', stake: 'the field' });
    go(s, { verdict: 'continue', change: { stake: 'the whole village' } });
    expect(s.stage.scenario!.stake).toBe('the whole village');
    expect(checkCheckin({ verdict: 'continue', change: { stake: 'x' } }).errors).toEqual([]);
  });
});
