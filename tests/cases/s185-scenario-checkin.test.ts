// 185 Scenario fallbacks and the Weaver check-in (SC8, SC12, SC14, SC15): the budget (fights not counted), check-ins asked at
// set moments within their limits, answers applied to the scenario they were about, code endings and failed check-ins filed
// as bugs, and the GM's End scenario.
import { describe, expect, it } from 'vitest';
import type { CheckinAnswer, GameState, PlanEnding, Trigger } from '../../src/types';
import { actor, createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { fireTurnStartTriggers } from '../../src/engine/triggers';
import { applyCheckin, budgetUsed, checkScenarioEnd, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { ScenarioDirector } from '../../src/scenario/director';
import { VirtualClock } from '../../src/scenario/fixtures';
import { isBugCode } from '../../src/save/bugs';
import { checkCheckin } from '../../src/agents/schema';
import { FIXED } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';
import { advanceClock } from '../../src/time';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const calm = () => makeVillage({ without: ['slime_1', 'slime_2'] });
const frame = (s: GameState, scale = 'moment', endings = judged) => (s.stage.scenario = frameOf(s, { question: 'q', scale, endings }, 'success', (_k, r) => r));
const turn = (s: GameState) => { s.turn += 1; return resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const codes = (s: GameState) => s.log.map((l) => l.code);
const beat = (id: string): Trigger => ({ id, ownerId: 'trader', when: { type: 'quiet_turns', turns: 3 }, then: { type: 'talk', target: '$player', skill: null, intent: 'news' } as Trigger['then'], once: true });

describe('185 budget and code endings (SC2, SC12)', () => {
  it('the budget is game time, fights included (AT83)', () => {
    const s = makeVillage();
    frame(s);
    s.turn += 6;
    expect(budgetUsed(s, s.stage.scenario!)).toBe(0); // turns alone use none of it
    advanceClock(s, 6);
    expect(budgetUsed(s, s.stage.scenario!)).toBeCloseTo(6 / CONFIG.SCENARIO_SCALE.moment.budgetMin);
  });
  it('at twice the budget code ends the scenario as worn out, after any fight, and files a bug', () => {
    const s = makeVillage();
    frame(s, 'moment', [{ when: { kind: 'judged' }, as: 'resolved', text: '' }, { when: { kind: 'judged' }, as: 'lost', text: '' }]);
    s.stage.scenario!.lastCheckin = s.turn; // no check-in in the way
    advanceClock(s, CONFIG.SCENARIO_OVERRUN_MULT * CONFIG.SCENARIO_SCALE.moment.budgetMin);
    actor(s, 'slime_1').mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [] } as never;
    checkScenarioEnd(s, []);
    expect(s.stage.ending?.as).toBe('worn_out');
    expect(s.stage.breakCause).toBeUndefined(); // held: a fight is on
    expect(codes(s)).toContain('scenario_overrun');
    expect(isBugCode('scenario_overrun')).toBe(true);
  });
  it('a stall (no beat left) is a code ending too, and a bug', () => {
    const s = calm();
    frame(s);
    for (let i = 0; i < CONFIG.STALL_TURNS; i++) turn(s);
    expect(s.hidden.scenarios?.at(-1)?.ending).toBe('worn_out');
    expect(s.log.some((l) => l.code === 'scenario_stalled')).toBe(true);
    expect(isBugCode('scenario_stalled')).toBe(true);
  });
});

describe('185 when a check-in is asked (SC8)', () => {
  it('at the budget once, when a beat fires, and every few turns for endings only the Weaver can judge, within the limits', () => {
    const s = calm();
    frame(s);
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    checkScenarioEnd(s, []);
    expect(s.stage.checkinDue).toBe('judged');
    delete s.stage.checkinDue;
    s.stage.scenario!.lastCheckin = s.turn;
    s.turn += 1;
    checkScenarioEnd(s, []);
    expect(s.stage.checkinDue).toBeUndefined(); // too soon after the last one
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    advanceClock(s, CONFIG.SCENARIO_SCALE.moment.budgetMin);
    checkScenarioEnd(s, []);
    expect(s.stage.checkinDue).toBe('budget');
    expect(s.stage.scenario!.overTime).toBe(true);
    s.stage.scenario!.checkins = CONFIG.CHECKIN_MAX_PER_SCENARIO;
    delete s.stage.checkinDue;
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    checkScenarioEnd(s, []);
    expect(s.stage.checkinDue).toBeUndefined(); // the scenario used all its check-ins
  });
  it('BG-42: the over-time check-in still comes when the scenario has used all its check-ins, and does not count', () => {
    const s = calm();
    frame(s);
    s.stage.scenario!.checkins = CONFIG.CHECKIN_MAX_PER_SCENARIO;
    s.stage.scenario!.lastCheckin = s.turn;
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    advanceClock(s, CONFIG.SCENARIO_SCALE.moment.budgetMin);
    checkScenarioEnd(s, []);
    expect(s.stage.checkinDue).toBe('budget');
    const d = new ScenarioDirector({ weave: async () => null, clock: new VirtualClock(), checkin: async () => null });
    expect(d.startCheckin(s)).toBe(true);
    expect(s.stage.scenario!.checkins).toBe(CONFIG.CHECKIN_MAX_PER_SCENARIO);
  });
  it('a beat that fires is a check-in moment', () => {
    const s = calm();
    frame(s, 'situation', [{ when: { kind: 'hold', item: 'nothing_here' }, as: 'resolved', text: '' }, { when: { kind: 'leave', place: 'tavern' }, as: 'left', text: '' }]);
    s.hidden.plans.trader = { goal: '', steps: [], triggers: [{ ...beat('b'), when: { type: 'quiet_turns', turns: 1 } }], createdTurn: 0 };
    turn(s);
    expect(fireTurnStartTriggers(s, s.turn + 1).fired).toEqual(['b']);
    turn(s);
    expect(s.stage.checkinDue).toBe('beat');
  });
});

describe('185 the check-in call and its answer (SC8, SC14)', () => {
  it('starts after a save, in the background, and its answer is taken once', async () => {
    const s = calm();
    frame(s);
    s.stage.checkinDue = 'judged';
    let seen: unknown;
    const d = new ScenarioDirector({ weave: async () => null, clock: new VirtualClock(), checkin: async (v) => { seen = v.target; return { verdict: 'continue' }; } });
    d.afterSave(s);
    expect(s.stage.checkinDue).toBeUndefined();
    expect(s.stage.scenario).toMatchObject({ checkins: 1, lastCheckin: s.turn });
    expect(seen).toMatchObject({ kind: 'checkin', reason: 'judged', scenario: { question: 'q', scale: 'Moment' } });
    await Promise.resolve(); await Promise.resolve();
    expect(d.takeCheckin()).toMatchObject({ number: s.stage.scenario!.number, answer: { verdict: 'continue' } });
    expect(d.takeCheckin()).toBeNull();
  });
  it('an end ends the scenario (after a clear turn) and is recorded', () => {
    const s = calm();
    frame(s);
    applyCheckin(s, s.stage.scenario!.number, { verdict: 'end', as: 'resolved', text: 'the debt is paid' }, []);
    expect(s.hidden.scenarios?.at(-1)).toMatchObject({ ending: 'resolved', text: 'the debt is paid' });
    expect(s.stage.roam).toEqual({ since: s.turn }); // SD2 a: every ending starts free roam for now
    expect(s.stage.breakCause).toBeUndefined();
  });
  it('continue adds its beats to their owners', () => {
    const s = calm();
    frame(s);
    applyCheckin(s, s.stage.scenario!.number, { verdict: 'continue', beats: [beat('watch')] }, []);
    expect(s.hidden.plans.trader.triggers.map((t) => t.id)).toEqual([`ci${s.turn}_0_watch`]);
    expect(s.stage.breakCause).toBeUndefined();
  });
  it('a failed or invalid answer changes nothing and files a bug; an answer about a scenario that is over is dropped', () => {
    const s = calm();
    frame(s);
    const n = s.stage.scenario!.number;
    applyCheckin(s, n, null, []);
    applyCheckin(s, n, { verdict: 'end', as: 'worn_out' } as CheckinAnswer, []);
    applyCheckin(s, n, { verdict: 'continue', beats: [{ ...beat('x'), ownerId: 'nobody' }] }, []);
    expect(codes(s).filter((c) => c === 'checkin_failed')).toHaveLength(3);
    expect(isBugCode('checkin_failed')).toBe(true);
    expect(s.stage.breakCause).toBeUndefined();
    applyCheckin(s, n - 1, { verdict: 'end', as: 'lost' }, []);
    expect(s.stage.breakCause).toBeUndefined();
  });
  it('the schema reads an answer, and the check-in has its own instructions', () => {
    expect(checkCheckin({ verdict: 'end', as: 'escaped', text: 't' }).errors).toEqual([]);
    expect(checkCheckin({ verdict: 'maybe' }).errors.length).toBeGreaterThan(0);
    expect(FIXED.checkin).toContain('checking in on a scenario');
  });
});

describe('185 the GM ends a scenario (SC15)', () => {
  it('ends after the next turn, recorded as interrupted', () => {
    const s = calm();
    frame(s);
    endScenario(s, 'interrupted', 'ended from the GM view');
    turn(s);
    expect(s.hidden.scenarios?.at(-1)).toMatchObject({ ending: 'interrupted', text: 'ended from the GM view' });
  });
});

describe('185 BG-41 the check-in sees what happened', () => {
  it('spars, yields, gives and memory lines since the scenario began reach the check-in view', async () => {
    const { noteHappened } = await import('../../src/engine/happened');
    const { buildWeaverView } = await import('../../src/views');
    const s = calm();
    frame(s);
    s.turn += 9;
    s.log.push({ turn: s.turn, code: 'spar_out', detail: { id: 'sp1', actorId: 'patron_1', reason: 'yielded' } });
    s.log.push({ turn: s.turn, code: 'spar_ended', detail: { id: 'sp1', cause: 'yielded', winners: ['player'] } });
    const coin = s.player.core.inventory.find((i) => i.id === 'player_coin')!;
    noteHappened(s, [{ id: 'g', turn: s.turn, actorId: 'player', kind: 'give', target: 'trader', itemId: coin.id, zone: s.player.zone, effects: [], noise: 'normal', visibility: 'normal', perception: {} }], []);
    s.hidden.memory.patron_1 = [{ turn: s.turn - 20, text: 'old' }, { turn: s.turn, text: 'The stranger beat me fairly in a bout.' }];
    const v = buildWeaverView(s, { kind: 'checkin', placeId: s.player.placeId, reason: 'judged' });
    expect(v.target.scenario!.happened.map((h) => h.text)).toEqual(['the player gave Mags coin', 'Old Wim yielded in the spar', 'the spar ended: won by the player']);
    expect(v.target.scenario!.remembered).toEqual([{ who: 'patron_1', turn: s.turn, text: 'The stranger beat me fairly in a bout.' }]);
    expect(FIXED.checkin).toContain('Never add a beat for something that already happened');
  });
});
