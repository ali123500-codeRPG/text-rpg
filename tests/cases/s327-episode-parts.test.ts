// 327 SW10 a: an Episode holds the scenarios inside it. With no bigger scenario running, a scenario start plans the Episode
// (or bigger: its own question, stake and endings) and its first part (a moment or situation). When a part ends, play is back
// in the Episode, between parts: the same things that start a scenario in free roam (danger at once; a job, a goal reached,
// a stale job or a quiet stretch as a window the Weaver may decline) start the next part inside it, with its own event roll.
// The Episode ends by its own endings or budget, and then free roam starts.
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, PlanEnding, StagePlan } from '../../src/types';
import type { PlanContext } from '../../src/scenario';
import { makeVillage } from '../harness/village';
import { intent, narrateAll } from '../harness/turn';
import { ScriptedClaude } from '../harness/scripted';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore } from '../../src/save';
import { applyWindow, checkRoam } from '../../src/engine/chase';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { beginScenario } from '../../src/scenario/apply';
import { validateStagePlan } from '../../src/scenario/validate';
import { toStoryStart, villageStagePlan, FITTING_GRADES } from '../../src/scenario/fixtures';
import { noteHappened } from '../../src/engine/happened';
import { FIXED } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';
import { MILL_PLAN } from './scenario-director';

const judged: PlanEnding[] = [{ when: { kind: 'judged' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }];
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const ev = (turn: number, e: Partial<GameEvent>): GameEvent => ({ id: `e${turn}`, turn, actorId: 'player', kind: 'attack', target: 'patron_1', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...e } as GameEvent);
const codes = (s: GameState) => s.log.map((l) => l.code);
/** an Episode running between its parts, since the turn before */
const between = (): GameState => {
  const s = makeVillage();
  s.stage.scenario = frameOf(s, { question: 'who poisons the well?', stake: 'the village sickens', scale: 'episode', endings: judged }, 'success', (_k, r) => r);
  s.stage.between = { since: s.turn - 1, sinceMin: 0, rest: 0 };
  return s;
};
const moment = (): StagePlan => ({ ...villageStagePlan(), scenario: { ...villageStagePlan().scenario!, scale: 'moment' } });

describe('327 an Episode holds its parts (SW10 a)', () => {
  it('a start with no bigger scenario plans the episode too; a moment alone is sent back, an episode alone is fine', () => {
    const p = moment();
    // the village plan holds more places than a moment: code raises it to an episode, which needs no bigger one
    expect(validateStagePlan(toStoryStart(makeVillage()), p, ctx).map((e) => e.code)).toEqual(['scenario_scale_raised']);
    p.scenario!.scale = 'moment';
    expect(validateStagePlan(toStoryStart(makeVillage()), { ...p, zones: [] }, ctx).map((e) => e.code)).toContain('episode_missing');
    p.episode = { question: 'will the slimes leave the valley?', stake: 'the harvest', scale: 'episode', endings: judged };
    expect(validateStagePlan(toStoryStart(makeVillage()), p, ctx)).toEqual([]);
    p.episode.scale = 'situation';
    expect(validateStagePlan(toStoryStart(makeVillage()), p, ctx).map((e) => e.code)).toContain('episode_scale');
    p.episode.scale = 'journey';
    p.scenario!.scale = 'episode';
    expect(validateStagePlan(toStoryStart(makeVillage()), p, ctx).map((e) => e.code)).toContain('scenario_scale_inner');
    expect(validateStagePlan(toStoryStart(makeVillage()), villageStagePlan(), ctx)).toEqual([]); // the village plan is an episode itself
    expect(FIXED.weaver).toContain('episode (SW10): on a scenario start with no WEAVER_VIEW.outerScenario, plan two things');
  });

  it('inside a bigger scenario the start needs no episode', () => {
    const s = toStoryStart(makeVillage());
    s.stage.outer = frameOf(s, { question: 'E', stake: 'e', scale: 'episode', endings: judged }, 'success', (_k, r) => r);
    expect(validateStagePlan(s, { ...moment(), zones: [] }, ctx).map((e) => e.code)).not.toContain('episode_missing');
  });

  it('a part ends: play is back in the Episode, between parts, after a rest; the Episode\'s own ending brings free roam', () => {
    const s = makeVillage();
    s.stage.outer = frameOf(s, { question: 'E', stake: 'e', scale: 'episode', endings: judged }, 'success', (_k, r) => r);
    s.stage.scenario = frameOf(s, { question: 'part', stake: 'p', scale: 'moment', endings: judged }, 'success', (_k, r) => r);
    s.hidden.stage = { ...s.hidden.stage!, challenge: 'major' };
    endScenario(s, 'resolved');
    expect(closeScenario(s)).toBe('resume');
    expect(s.stage.scenario?.question).toBe('E');
    expect(s.stage.between).toMatchObject({ since: s.turn, rest: CONFIG.ROAM_REST_MIN.major });
    expect(s.stage.roam).toBeUndefined();
    endScenario(s, 'resolved');
    expect(closeScenario(s)).toBe('roam');
    expect(s.stage.between).toBeUndefined();
    expect(s.stage.roam).toBeDefined();
  });

  it('between parts, an attack starts the next part: nothing closes, and the Episode becomes the bigger scenario when it begins', () => {
    const s = between();
    s.player.progression!.marks = [{ skill: 'x' } as never];
    noteHappened(s, [ev(s.turn, {})], []);
    expect(s.stage.scenario!.happened?.some((h) => h.text.includes('attacked'))).toBe(true);
    checkRoam(s, [ev(s.turn, {})]);
    expect(s.stage.breakCause).toBe('roam');
    expect(s.stage.cause).toMatchObject({ why: 'attack' });
    expect(s.stage.cause!.happened.some((h) => h.text.includes('attacked'))).toBe(true);
    expect(closeScenario(s)).toBe('new');
    expect(s.stage.scenario?.question).toBe('who poisons the well?'); // still running until the part begins
    expect(s.hidden.scenarios ?? []).toHaveLength(0);
    beginScenario(s, 'failure');
    expect(s.stage.outer?.question).toBe('who poisons the well?');
    expect(s.stage.outer?.held?.marks).toHaveLength(1); // its growth waits for its own end
    expect(s.stage.scenario).toBeUndefined();
    expect(s.stage.between).toBeUndefined();
    expect(codes(s)).toContain('episode_inner');
  });

  it('between parts, a job opens a window; the Weaver may decline it', () => {
    const s = between();
    s.log.push({ turn: s.turn, code: 'quest_made', detail: { id: 'q1', giver: 'trader' } });
    checkRoam(s, []);
    expect(s.stage.window).toBe('due');
    applyWindow(s, { start: false });
    expect(s.stage.between!.declinedAt).toBeDefined();
    expect(s.stage.breakCause).toBeUndefined();
  });

  it('with a part running inside it, the Episode starts nothing by itself', () => {
    const s = between();
    s.stage.outer = s.stage.scenario;
    s.stage.scenario = frameOf(s, { question: 'part', stake: 'p', scale: 'moment', endings: judged }, 'success', (_k, r) => r);
    checkRoam(s, [ev(s.turn, {})]);
    expect(s.stage.breakCause).toBeUndefined();
  });

  it('whole turn: the first start makes the episode and its first part; an attack between parts starts the next part inside it', async () => {
    const clock = new VirtualClock(), claude = new ScriptedClaude(clock), store = memoryStore();
    const game = createGame({ client: claude, clock, store, director: createDirector(clock) });
    const state = between();
    state.pending = { turn: state.turn, mode: 'explore', engaged: [], fired: [] };
    claude.defaults.narrator = narrateAll();
    const views: unknown[] = [];
    claude.defaults.weaver = (req) => {
      views.push(req);
      const s = game.state()!;
      return { ok: true, value: { ...MILL_PLAN, event: { ...MILL_PLAN.event, ...FITTING_GRADES[s.stage.starting!.eventRoll.tier] } } as StagePlan };
    };
    game.adopt(state);
    claude.push('parser', intent({ action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' } }));
    await game.submit('I punch the patron', { aimed: false });
    await game.settle();
    let s = game.state()!;
    expect(s.stage.starting).toBeDefined();
    expect(s.stage.scenario?.question).toBe('who poisons the well?');
    claude.push('parser', intent());
    await game.submit('look around', { aimed: false });
    await game.settle();
    s = game.state()!;
    expect(s.stage.outer?.question).toBe('who poisons the well?');
    expect(s.stage.scenario?.question).toBe('what waits at the old mill?'); // the plan's episode is left out: one is running
    expect(s.stage.outer?.ground).toEqual(expect.arrayContaining(s.stage.scenario!.ground!));
    expect(JSON.stringify(views.at(-1))).toContain('who poisons the well?'); // the Weaver saw the episode as outerScenario
    expect(s.stage.roam).toBeUndefined();
  });

  it('the first start applies the episode and its first part, each its own number', () => {
    const s = between();
    delete s.stage.scenario; delete s.stage.between;
    s.stage.roam = { since: s.turn - 1 };
    s.stage.breakCause = 'roam';
    const before = s.stage.scenarioNumber;
    return (async () => {
      const { ScenarioDirector } = await import('../../src/scenario');
      const { VirtualClock: SceneClock } = await import('../../src/scenario/fixtures');
      const { createRng } = await import('../harness');
      const d = new ScenarioDirector({ clock: new SceneClock(), weave: async () => ({ ...MILL_PLAN, event: { ...MILL_PLAN.event, ...FITTING_GRADES[s.stage.tier] } }) as StagePlan });
      await d.startScenario(s, createRng(5));
      expect(s.stage.outer?.question).toBe('who is behind the slimes at the mill?');
      expect(s.stage.outer?.stake).toBe('the village loses its mill');
      expect(s.stage.scenario?.question).toBe('what waits at the old mill?');
      expect(s.stage.outer!.number).toBe(before + 1);
      expect(s.stage.scenario!.number).toBe(before + 2);
      expect(codes(s)).toContain('episode_planned');
      expect(s.stage.between).toBeUndefined();
    })();
  });
});
