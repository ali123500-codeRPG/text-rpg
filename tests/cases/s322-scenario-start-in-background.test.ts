// 322 BF63 (BG-238): danger in free roam starts a scenario without the turn waiting for the Weaver. The turn ends at once with
// the event roll saved (stage.starting); the Weaver plans in the background after the save, logged under the next turn; the
// scenario starts after that turn, with its opening. Free roam goes on meanwhile and nothing else starts a scenario; a
// reload plans it then, with the saved roll; a knock-out or road encounter first drops it.
import { describe, expect, it } from 'vitest';
import type { GameEvent, StagePlan } from '../../src/types';
import { makeVillage } from '../harness/village';
import { intent, narrateAll } from '../harness/turn';
import { ScriptedClaude } from '../harness/scripted';
import { createRng } from '../harness';
import { createGame, VirtualClock } from '../../src/agents';
import { createDirector } from '../../src/agents/director';
import { memoryStore, readTurnRecord } from '../../src/save';
import { checkRoam } from '../../src/engine/chase';
import { ScenarioDirector } from '../../src/scenario';
import { FITTING_GRADES, VirtualClock as SceneClock } from '../../src/scenario/fixtures';
import { MILL_PLAN } from './scenario-director';

const ev = (turn: number, e: Partial<GameEvent>): GameEvent => ({ id: `e${turn}`, turn, actorId: 'player', kind: 'attack', target: 'patron_1', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...e } as GameEvent);

describe('322 a scenario started in free roam is planned in the background', () => {
  it('the attack turn ends without a Weaver call; the next turn opens the scenario from the background plan', async () => {
    const clock = new VirtualClock(), claude = new ScriptedClaude(clock), store = memoryStore();
    const game = createGame({ client: claude, clock, store, director: createDirector(clock) });
    const state = makeVillage();
    state.pending = { turn: state.turn, mode: 'explore', engaged: [], fired: [] };
    delete state.stage.scenario;
    state.stage.roam = { since: state.turn - 1 };
    claude.defaults.narrator = narrateAll();
    let weaverAt = -1;
    claude.defaults.weaver = () => {
      const s = game.state()!;
      weaverAt = s.turn;
      return { ok: true, value: { ...MILL_PLAN, event: { ...MILL_PLAN.event, ...FITTING_GRADES[s.stage.starting!.eventRoll.tier] } } as StagePlan };
    };
    game.adopt(state);
    const number = state.stage.scenarioNumber, first = state.turn;
    claude.push('parser', intent({ action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } }));
    await game.submit('I punch the patron', { aimed: false });
    await game.settle();
    let s = game.state()!;
    const held = s.stage.starting!;
    expect(held.turn).toBe(first);
    expect(s.stage.scenarioNumber).toBe(number); // not started yet: free roam goes on
    expect(s.stage.roam).toBeDefined();
    const rec1 = (await readTurnRecord(store, s.storyId, first))!;
    expect(rec1.eventRoll).toBeUndefined();
    expect(rec1.agentLog.some((l) => l.agent === 'weaver')).toBe(false); // the turn never waited on the Weaver
    expect(weaverAt).toBe(first + 1); // asked after the save, under the next turn

    claude.push('parser', intent());
    await game.submit('look around', { aimed: false });
    await game.settle();
    s = game.state()!;
    expect(claude.callsFor('weaver')).toHaveLength(1); // the background plan was used, not a second call
    expect(s.stage.starting).toBeUndefined();
    expect(s.stage.roam).toBeUndefined();
    expect(s.stage.scenarioNumber).toBe(number + 1);
    expect(s.stage.cause).toBeUndefined();
    expect(s.stage.fallback).toBeUndefined();
    expect(s.zones.some((z) => z.name === 'mill yard')).toBe(true);
    const rec2 = (await readTurnRecord(store, s.storyId, first + 1))!;
    expect(rec2.eventRoll).toEqual(held.eventRoll); // the roll saved on the attack turn
    expect(rec2.agentLog.some((l) => l.agent === 'weaver')).toBe(true); // replay of this turn finds the plan
  });

  it('held, nothing else starts one; after a reload the start plans then, with the saved roll; another start drops it', async () => {
    const s = makeVillage();
    delete s.stage.scenario;
    s.stage.roam = { since: s.turn - 1 };
    let calls = 0;
    const d = new ScenarioDirector({ clock: new SceneClock(), weave: async () => { calls++; return null; } });
    d.holdStart(s, createRng(3));
    const roll = s.stage.starting!.eventRoll;
    expect(s.stage.breakCause).toBeUndefined();
    s.turn += 1;
    checkRoam(s, [ev(s.turn, {})]);
    expect(s.stage.breakCause).toBeUndefined(); // one is on its way
    const fresh = new ScenarioDirector({ clock: new SceneClock(), weave: async () => { calls++; return null; } }); // a reload: no plan in flight
    const r = await fresh.startScenario(s, createRng(9));
    expect(r.eventRoll).toEqual(roll);
    expect(calls).toBe(1);
    expect(s.stage.starting).toBeUndefined();

    const t = makeVillage();
    delete t.stage.scenario;
    t.stage.roam = { since: t.turn - 1 };
    d.holdStart(t, createRng(3));
    d.dropHeld(t);
    expect(t.stage.starting).toBeUndefined();
  });
});
