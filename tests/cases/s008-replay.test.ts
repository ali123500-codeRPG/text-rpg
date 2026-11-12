// Test 8: the same saved state, RNG state and logged agent outputs reproduce the same events,
// run under the library version the turn record names. Goes green when W4's resolveTurn lands.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { resolveSpeech, resolveTurn } from '../../src/engine';
import { getLibrary } from '../../src/library';
import { loadStory, memoryStore, readTurnRecord, saveTurn } from '../../src/save';
import { ReplayRefused, replayTurn } from '../../src/save/replay';
import type { AgentTurnLog, Intent, PlannerOutput, TurnRecord } from '../../src/types';

describe('8 Replay', () => {
  it('reproduces the turn from the save and the turn record', async () => {
    const s = makeVillage({ playerZone: 'gate_inner' });
    const st = memoryStore();
    await saveTurn(st, s, { storyId: 'test', turn: 0, libraryVersion: s.libraryVersion, rngBefore: s.rngState, playerInput: '', agentLog: [], events: [], factsAdded: [] });
    const { state: saved } = await loadStory(st, 'test', getLibrary());

    // live turn 1: the player walks to the square; the gate guard (agent-controlled) holds
    const live = structuredClone(saved);
    const rngBefore = live.rngState;
    const rng = createRng(rngBefore);
    const intent: Intent = { move: { toZone: 'street_square' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
    const planner: PlannerOutput = {
      action: { type: 'hold', target: null, skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'keep watch' },
      dialogue: null, gear: null, stance: null, planUpdate: null,
    };
    const events = resolveTurn(live, { intent, aimed: false, agentOutputs: [{ agent: 'planner', actorId: 'guard_1', output: planner }], spokespeople: [] }, rng);
    live.rngState = rng.state;
    const agentLog: AgentTurnLog[] = [
      { turn: 1, agent: 'parser', input: 'view', output: intent, status: 'ok', errors: [] },
      { turn: 1, agent: 'planner', actorId: 'guard_1', input: 'view', output: planner, status: 'ok', errors: [] },
    ];
    const record: TurnRecord = { storyId: 'test', turn: 1, libraryVersion: getLibrary().version, rngBefore, playerInput: 'I walk to the square', agentLog, events, factsAdded: [] };
    await saveTurn(st, live, record);

    const stored = (await readTurnRecord(st, 'test', 1))!;
    const replay = replayTurn(saved, stored, { libraryVersion: getLibrary().version, resolveTurn, resolveSpeech });
    expect(events.length).toBeGreaterThan(0);
    expect(replay.events).toEqual(JSON.parse(JSON.stringify(events)));
    expect(replay.rngState).toBe(live.rngState);
    expect(replay.state.player.zone).toBe(live.player.zone);

    expect(() => replayTurn(saved, stored, { libraryVersion: stored.libraryVersion + 1, resolveTurn, resolveSpeech })).toThrow(ReplayRefused);
  });
});
