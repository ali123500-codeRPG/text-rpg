// Test 44: undoing the scene-start turn and redoing it makes a new situation roll and a new Weaver call.
// Goes green when W4 (resolveTurn) and W6 (src/scene/director.ts) land.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, readTurnRecord, saveTurn, undoTurn } from '../../src/save';
import type { GameState } from '../../src/types';
import { MILL_PLAN, loadDirector } from './scene-director';

describe('44 Undo rerolls the hand', () => {
  it('a redone scene start rolls from the carried-forward RNG and calls the Weaver again', async () => {
    const director = await loadDirector();
    const s = makeVillage({ playerZone: 'field_edge' });
    const st = memoryStore();
    await saveTurn(st, s, { storyId: 'test', turn: 0, libraryVersion: s.libraryVersion, rngBefore: s.rngState, playerInput: '', agentLog: [], events: [], factsAdded: [] });
    const claude = new ScriptedClaude().push('weaver', MILL_PLAN).push('weaver', MILL_PLAN);

    const sceneTurn = async (state: GameState) => {
      const rngBefore = state.rngState;
      const rng = createRng(rngBefore);
      const events = resolveTurn(state, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, rng);
      const setup = await director.runSceneSetup(state, { claude, rng });
      state.rngState = rng.state;
      return { rngBefore, situation: setup.situation, record: { storyId: 'test', turn: 1, libraryVersion: getLibrary().version, rngBefore, playerInput: 'I rest', agentLog: setup.agentLog, events: [...events, ...setup.events], factsAdded: [], situation: setup.situation } };
    };

    const first = structuredClone((await loadStory(st, 'test', getLibrary())).state);
    const t1 = await sceneTurn(first);
    await saveTurn(st, first, t1.record);
    expect(claude.callsFor('weaver')).toHaveLength(1);

    await undoTurn(st, 'test');
    expect(await readTurnRecord(st, 'test', 1)).toBeNull();
    const back = (await loadStory(st, 'test', getLibrary())).state;
    expect(back.rngState).toBe(first.rngState); // the RNG does not roll back
    expect(back.rngState).not.toBe(t1.rngBefore);

    const t2 = await sceneTurn(back);
    expect(t2.rngBefore).not.toBe(t1.rngBefore); // a new situation roll, from new dice
    expect(claude.callsFor('weaver')).toHaveLength(2); // and a new Weaver call
    await saveTurn(st, back, t2.record);
    expect((await readTurnRecord(st, 'test', 1))!.situation).toEqual(t2.situation);
  });
});
