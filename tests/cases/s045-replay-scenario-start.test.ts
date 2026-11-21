// Test 45: saved state, RNG state and the logged Weaver output reproduce the same stage, with no Weaver call.
// Test 44 (merged here): undoing the scenario-start turn and redoing it makes a new event roll and a new Weaver call.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, createRng, makeVillage } from '../harness';
import { resolveSpeech, resolveTurn } from '../../src/engine';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, readTurnRecord, saveTurn, undoTurn } from '../../src/save';
import { replayTurn } from '../../src/save/replay';
import type { GameState } from '../../src/types';
import { loadDirector, millWeaver } from './scenario-director';

describe('45 Replay of a scenario start (and 44: undo rerolls the hand)', () => {
  it('rebuilds the same stage from the turn record without calling the Weaver; undone and redone, it rolls from the carried-forward RNG and calls the Weaver again', async () => {
    const director = await loadDirector();
    const s = makeVillage({ playerZone: 'field_edge' });
    const st = memoryStore();
    await saveTurn(st, s, { storyId: 'test', turn: 0, libraryVersion: s.libraryVersion, rngBefore: s.rngState, playerInput: '', agentLog: [], events: [], factsAdded: [] });
    const saved = (await loadStory(st, 'test', getLibrary())).state;
    const claude = new ScriptedClaude().pushResponse({ agent: 'weaver', response: millWeaver }).pushResponse({ agent: 'weaver', response: millWeaver });

    const scenarioTurn = async (state: GameState) => {
      const rngBefore = state.rngState;
      const rng = createRng(rngBefore);
      const events = resolveTurn(state, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, rng);
      const setup = await director.runScenarioSetup(state, { claude, rng });
      state.rngState = rng.state;
      return { rngBefore, eventRoll: setup.eventRoll, record: { storyId: 'test', turn: 1, libraryVersion: getLibrary().version, rngBefore, playerInput: 'I rest', agentLog: setup.agentLog, events: [...events, ...setup.events], factsAdded: [], eventRoll: setup.eventRoll } };
    };

    const live = structuredClone(saved);
    const t1 = await scenarioTurn(live);
    await saveTurn(st, live, t1.record);
    expect(claude.callsFor('weaver')).toHaveLength(1);

    // 45: replay
    const record = (await readTurnRecord(st, 'test', 1))!;
    const replay = replayTurn(saved, record, { libraryVersion: getLibrary().version, resolveTurn, resolveSpeech, replayScenarioStart: director.replayScenarioSetup });
    expect(claude.callsFor('weaver')).toHaveLength(1); // no new Weaver call
    expect(replay.state.stage).toEqual(live.stage);
    expect(replay.state.zones.map((z) => z.id)).toEqual(live.zones.map((z) => z.id));
    expect(replay.state.places).toEqual(JSON.parse(JSON.stringify(live.places)));
    expect(replay.events).toEqual(JSON.parse(JSON.stringify(record.events)));
    expect(replay.rngState).toBe(live.rngState);

    // 44: undo, then redo
    await undoTurn(st, 'test');
    expect(await readTurnRecord(st, 'test', 1)).toBeNull();
    const back = (await loadStory(st, 'test', getLibrary())).state;
    expect(back.rngState).toBe(live.rngState); // the RNG does not roll back
    expect(back.rngState).not.toBe(t1.rngBefore);
    const t2 = await scenarioTurn(back);
    expect(t2.rngBefore).not.toBe(t1.rngBefore); // a new event roll, from new dice
    expect(claude.callsFor('weaver')).toHaveLength(2); // and a new Weaver call
    await saveTurn(st, back, t2.record);
    expect((await readTurnRecord(st, 'test', 1))!.eventRoll).toEqual(t2.eventRoll);
  });
});
