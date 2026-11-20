// 311 Speech in character: the agent bar's "In character" style speaks and plays from the player character's personality line, and
// signatures set on the Character page join that line (and so reach the narrator, and the Planner and Responder for an NPC).
import { describe, expect, it, vi } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };

describe('311 speech in character', () => {

  it('set in play, signatures are saved at once and a reload keeps them', async () => {
    const clock = new VirtualClock(), store = memoryStore(), s = makeVillage();
    await saveTurn(store, s, rec(s));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    expect(await g.resume()).toBe(true);
    g.setSignatures(['Speaks in proverbs.']);
    expect(g.state()?.player.core.signatures).toEqual(['Speaks in proverbs.']);
    await vi.waitFor(async () => {
      const again = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
      expect(await again.resume()).toBe(true);
      expect(again.state()?.player.core.signatures).toEqual(['Speaks in proverbs.']);
    });
  });

});
