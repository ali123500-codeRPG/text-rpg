// Test 45: saved state, RNG state and the logged Weaver output reproduce the same stage, with no Weaver call.
// Goes green when W4 (resolveTurn) and W6 (src/scene/director.ts) land.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, createRng, makeVillage } from '../harness';
import { resolveSpeech, resolveTurn } from '../../src/engine';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, readTurnRecord, saveTurn } from '../../src/save';
import { replayTurn } from '../../src/save/replay';
import { loadDirector, millWeaver } from './scene-director';

describe('45 Replay of a scene start', () => {
  it('rebuilds the same stage from the turn record without calling the Weaver', async () => {
    const director = await loadDirector();
    const s = makeVillage({ playerZone: 'field_edge' });
    const st = memoryStore();
    await saveTurn(st, s, { storyId: 'test', turn: 0, libraryVersion: s.libraryVersion, rngBefore: s.rngState, playerInput: '', agentLog: [], events: [], factsAdded: [] });
    const saved = (await loadStory(st, 'test', getLibrary())).state;

    const claude = new ScriptedClaude().pushResponse({ agent: 'weaver', response: millWeaver });
    const live = structuredClone(saved);
    const rngBefore = live.rngState;
    const rng = createRng(rngBefore);
    const events = resolveTurn(live, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, rng);
    const setup = await director.runSceneSetup(live, { claude, rng });
    live.rngState = rng.state;
    await saveTurn(st, live, {
      storyId: 'test', turn: 1, libraryVersion: getLibrary().version, rngBefore, playerInput: 'I rest',
      agentLog: setup.agentLog, events: [...events, ...setup.events], factsAdded: [], situation: setup.situation,
    });
    expect(claude.callsFor('weaver')).toHaveLength(1);

    const record = (await readTurnRecord(st, 'test', 1))!;
    const replay = replayTurn(saved, record, { libraryVersion: getLibrary().version, resolveTurn, resolveSpeech, replaySceneStart: director.replaySceneSetup });
    expect(claude.callsFor('weaver')).toHaveLength(1); // no new Weaver call
    expect(replay.state.stage).toEqual(live.stage);
    expect(replay.state.zones.map((z) => z.id)).toEqual(live.zones.map((z) => z.id));
    expect(replay.state.places).toEqual(JSON.parse(JSON.stringify(live.places)));
    expect(replay.events).toEqual(JSON.parse(JSON.stringify(record.events)));
    expect(replay.rngState).toBe(live.rngState);
  });
});
