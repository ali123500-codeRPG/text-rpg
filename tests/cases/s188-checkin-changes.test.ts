// 188 SC12: a check-in's continue may change the running scenario (question, scale, endings), send people in through ways
// that already exist (arrivals start on a stage zone out of the player's sight and walk in), and add frontiers on stage
// zones. It never builds zones. One bad part drops the whole answer and files checkin_failed.
import { describe, expect, it } from 'vitest';
import type { CheckinAnswer, GameState, PlanEnding } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyCheckin, frameOf } from '../../src/engine/scenarioEnd';
import { applyCheckinPlan, checkinPlanErrors } from '../../src/scenario/checkin';
import { checkCheckin } from '../../src/agents/schema';
import { TP } from '../../src/library/templateIds';
import { waysOut } from '../../src/plan/where';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const setup = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  // BG-1775: a ground, as every scenario started from a plan keeps one
  s.stage.scenario = { ...frameOf(s, { question: 'q', scale: 'situation', endings: judged }, 'success', (_k, r) => r), ground: ['tav_common'] };
  return s;
};
const riders = (zone: string): CheckinAnswer['arrivals'] => ({
  bands: [{ key: 'riders', name: 'the riders', goals: 'find the stranger', temperament: 'hard', lethal: true, relations: {} }],
  cast: [{ template: TP.guard, key: 'rider_1', label: 'a rider', name: 'Hal', appearance: 'a rider in a dusty cloak', band: 'riders', routineSetId: 'gate_guard',
    slots: { post: zone }, awarenessOfPlayer: 'unaware', motive: 'paid to bring the stranger back' }],
  seeds: { plans: [], triggers: [], secrets: [] },
});
const go = (s: GameState, a: CheckinAnswer) => applyCheckin(s, s.stage.scenario!.number, a, [], { errors: (x) => checkinPlanErrors(s, x), apply: (x) => applyCheckinPlan(s, x, createRng(2)) });
const codes = (s: GameState) => s.log.map((l) => l.code);

describe('188 what a check-in may change (SC12)', () => {
  it('an arrival in the player\'s sight drops the answer and files a bug; arrivals out of sight come in there and walk in', () => {
    const s = setup();
    go(s, { verdict: 'continue', arrivals: riders('tav_common') });
    expect(s.actors.some((a) => a.names.current === 'Hal')).toBe(false);
    expect(codes(s)).toContain('checkin_failed');
    go(s, { verdict: 'continue', arrivals: riders('street_square') });
    const hal = s.actors.find((a) => a.names.current === 'Hal')!;
    expect(hal.zone).toBe('street_square');
    expect(s.stage.scenario!.people).toContain(hal.id); // D-217 a: an arrival is someone the scenario brought
    expect(codes(s)).toContain('checkin_continue');
  });
  it('a change rewrites the question, scale and endings and keeps the scenario running', () => {
    const s = setup();
    const n = s.stage.scenario!.number;
    go(s, { verdict: 'continue', change: { question: 'will the stranger get away from the riders?', scale: 'episode', endings: [{ when: { kind: 'reach', place: 'field_far' }, as: 'escaped', text: 'away' }, judged[1]] } });
    expect(s.stage.scenario).toMatchObject({ number: n, question: 'will the stranger get away from the riders?', scale: 'episode' });
    expect(s.stage.scenario!.endings.map((e) => e.as)).toEqual(['escaped', 'lost']);
    go(s, { verdict: 'continue', change: { endings: [judged[0]] } }); // too few endings
    expect(codes(s)).toContain('checkin_failed');
    expect(s.stage.scenario!.endings).toHaveLength(2);
  });
  it('new frontiers open on stage zones; what lies behind is built later', () => {
    const s = setup();
    go(s, { verdict: 'continue', frontiers: [{ zone: 'tav_cellar', key: 'old_tunnel', label: 'a loose board over a tunnel' }] });
    expect(waysOut(s, 'tav_cellar').find((l) => l.label === 'a loose board over a tunnel')).toMatchObject({ frontier: true });
    go(s, { verdict: 'continue', frontiers: [{ zone: 'nowhere', key: 'x', label: 'y' }] });
    expect(codes(s)).toContain('checkin_failed');
  });
  it('the schema reads the new parts, and the Weaver is told never to add zones', () => {
    const v = checkCheckin({ verdict: 'continue', arrivals: riders('street_square'), frontiers: [{ zone: 'tav_cellar', key: 'k', label: 'l' }], change: { question: 'q2' }, zones: [{}] });
    expect(v.errors).toEqual([]);
    expect(v.value.arrivals!.cast[0]).toMatchObject({ key: 'rider_1' });
    expect(v.value).not.toHaveProperty('zones');
  });
});
