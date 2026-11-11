// 185 Scene fallbacks and the Weaver check-in (SC8, SC12, SC14, SC15): the budget (fights not counted), check-ins asked at
// set moments within their limits, answers applied to the scene they were about, code endings and failed check-ins filed
// as bugs, and the GM's End scene.
import { describe, expect, it } from 'vitest';
import type { CheckinAnswer, GameState, PlanEnding, Trigger } from '../../src/types';
import { actor, createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { fireTurnStartTriggers } from '../../src/engine/triggers';
import { applyCheckin, budgetUsed, checkSceneEnd, endScene, frameOf } from '../../src/engine/sceneEnd';
import { SceneDirector } from '../../src/scene/director';
import { VirtualClock } from '../../src/scene/fixtures';
import { isBugCode } from '../../src/save/bugs';
import { checkCheckin } from '../../src/agents/schema';
import { FIXED } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const calm = () => makeVillage({ without: ['slime_1', 'slime_2'] });
const frame = (s: GameState, scale = 'moment', endings = judged) => (s.stage.scene = frameOf(s, { question: 'q', scale, endings }, 'success', (_k, r) => r));
const turn = (s: GameState) => { s.turn += 1; return resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const codes = (s: GameState) => s.log.map((l) => l.code);
const beat = (id: string): Trigger => ({ id, ownerId: 'trader', when: { type: 'quiet_turns', turns: 3 }, then: { type: 'talk', target: '$player', skill: null, intent: 'news' } as Trigger['then'], once: true });

describe('185 budget and code endings (SC2, SC12)', () => {
  it('the budget leaves out turns spent fighting', () => {
    const s = makeVillage();
    frame(s);
    s.turn += 6;
    expect(budgetUsed(s, s.stage.scene!)).toBeCloseTo(6 / CONFIG.SCENE_SCALE.moment.budgetTurns!);
    s.stage.scene!.fightTurns = 6;
    expect(budgetUsed(s, s.stage.scene!)).toBe(0);
  });
  it('at twice the budget code ends the scene as worn out, after any fight, and files a bug', () => {
    const s = makeVillage();
    frame(s, 'moment', [{ when: { kind: 'judged' }, as: 'resolved', text: '' }, { when: { kind: 'judged' }, as: 'lost', text: '' }]);
    s.stage.scene!.lastCheckin = s.turn; // no check-in in the way
    s.turn += CONFIG.SCENE_OVERRUN_MULT * CONFIG.SCENE_SCALE.moment.budgetTurns! + 1; // +1: this turn is a fight turn
    actor(s, 'slime_1').mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [] } as never;
    checkSceneEnd(s, []);
    expect(s.stage.ending?.as).toBe('worn_out');
    expect(s.stage.breakCause).toBeUndefined(); // held: a fight is on
    expect(codes(s)).toContain('scene_overrun');
    expect(isBugCode('scene_overrun')).toBe(true);
  });
  it('a stall (no beat left) is a code ending too, and a bug', () => {
    const s = calm();
    frame(s);
    for (let i = 0; i < CONFIG.STALL_TURNS; i++) turn(s);
    expect(s.hidden.scenes?.at(-1)?.ending).toBe('worn_out');
    expect(s.log.some((l) => l.code === 'scene_stalled')).toBe(true);
    expect(isBugCode('scene_stalled')).toBe(true);
  });
});

describe('185 when a check-in is asked (SC8)', () => {
  it('at the budget once, when a beat fires, and every few turns for endings only the Weaver can judge, within the limits', () => {
    const s = calm();
    frame(s);
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    checkSceneEnd(s, []);
    expect(s.stage.checkinDue).toBe('judged');
    delete s.stage.checkinDue;
    s.stage.scene!.lastCheckin = s.turn;
    s.turn += 1;
    checkSceneEnd(s, []);
    expect(s.stage.checkinDue).toBeUndefined(); // too soon after the last one
    s.turn = s.stage.scene!.startTurn + CONFIG.SCENE_SCALE.moment.budgetTurns!;
    checkSceneEnd(s, []);
    expect(s.stage.checkinDue).toBe('budget');
    expect(s.stage.scene!.overTime).toBe(true);
    s.stage.scene!.checkins = CONFIG.CHECKIN_MAX_PER_SCENE;
    delete s.stage.checkinDue;
    s.turn += CONFIG.CHECKIN_GAP_TURNS;
    checkSceneEnd(s, []);
    expect(s.stage.checkinDue).toBeUndefined(); // the scene used all its check-ins
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
    const d = new SceneDirector({ weave: async () => null, clock: new VirtualClock(), checkin: async (v) => { seen = v.target; return { verdict: 'continue' }; } });
    d.afterSave(s);
    expect(s.stage.checkinDue).toBeUndefined();
    expect(s.stage.scene).toMatchObject({ checkins: 1, lastCheckin: s.turn });
    expect(seen).toMatchObject({ kind: 'checkin', reason: 'judged', scene: { question: 'q', scale: 'Moment' } });
    await Promise.resolve(); await Promise.resolve();
    expect(d.takeCheckin()).toMatchObject({ number: s.stage.scene!.number, answer: { verdict: 'continue' } });
    expect(d.takeCheckin()).toBeNull();
  });
  it('an end ends the scene (after a clear turn) and is recorded', () => {
    const s = calm();
    frame(s);
    applyCheckin(s, s.stage.scene!.number, { verdict: 'end', as: 'resolved', text: 'the debt is paid' }, []);
    expect(s.hidden.scenes?.at(-1)).toMatchObject({ ending: 'resolved', text: 'the debt is paid' });
    expect(s.stage.breakCause).toBe('scene_end');
  });
  it('continue adds its beats to their owners', () => {
    const s = calm();
    frame(s);
    applyCheckin(s, s.stage.scene!.number, { verdict: 'continue', beats: [beat('watch')] }, []);
    expect(s.hidden.plans.trader.triggers.map((t) => t.id)).toEqual([`ci${s.turn}_0_watch`]);
    expect(s.stage.breakCause).toBeUndefined();
  });
  it('a failed or invalid answer changes nothing and files a bug; an answer about a scene that is over is dropped', () => {
    const s = calm();
    frame(s);
    const n = s.stage.scene!.number;
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
    expect(FIXED.checkin).toContain('checking in on a scene');
  });
});

describe('185 the GM ends a scene (SC15)', () => {
  it('ends after the next turn, recorded as interrupted', () => {
    const s = calm();
    frame(s);
    endScene(s, 'interrupted', 'ended from the GM view');
    turn(s);
    expect(s.hidden.scenes?.at(-1)).toMatchObject({ ending: 'interrupted', text: 'ended from the GM view' });
  });
});
