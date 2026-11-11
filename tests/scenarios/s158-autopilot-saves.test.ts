// 158 Watch an agent play: one story per owner (the player's and the autopilot agent's own save), each resumed on its own;
// the autopilot's move is one command plus one short line of commentary.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type SceneDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { autopilotTurn, readMove } from '../../src/agents/autopilot';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: SceneDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
function story(id: string, createdAt: string, owner?: 'agent'): GameState {
  const s: GameState = JSON.parse(JSON.stringify(makeVillage()).replaceAll('"storyId":"test"', `"storyId":"${id}"`));
  s.meta = { ...s.meta, storyId: id, createdAt, ...(owner ? { owner } : {}) };
  return s;
}

describe('158 autopilot saves', () => {
  it('the player and the agent each keep one story; resume loads the owner\'s newest', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    await saveTurn(store, story('mine', '2026-11-10T10:00:00Z'), rec(story('mine', '2026-11-10T10:00:00Z')));
    const agent = story('agents', '2026-11-10T11:00:00Z', 'agent');
    await saveTurn(store, agent, rec(agent));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    expect(await g.resume()).toBe(true); // the default is the player's story, though the agent's is newer
    expect(g.state()?.storyId).toBe('mine');
    expect(await g.resume('agent')).toBe(true);
    expect(g.state()?.storyId).toBe('agents');
    expect(g.state()?.meta.owner).toBe('agent');
    expect(await g.resume('player')).toBe(true);
    expect(g.state()?.storyId).toBe('mine');
  });

  it('with no agent story yet, resume(agent) finds nothing and leaves room for a new one', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    await saveTurn(store, story('mine', '2026-11-10T10:00:00Z'), rec(story('mine', '2026-11-10T10:00:00Z')));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    expect(await g.resume('agent')).toBe(false);
  });

  it('the agent\'s move is one command line and a short spoken line', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const claude = new ScriptedClaude(clock).push('autopilot', { command: 'I ask the barkeep about work\nand more', say: 'Barkeeps hear everything.' });
    const g = createGame({ client: claude, clock, store, director: idle });
    expect(await g.agentMove('eager')).toEqual({ command: 'I ask the barkeep about work', say: 'Barkeeps hear everything.' });
    expect(claude.callsFor('autopilot')[0].input[1].content).toContain('Your playstyle:');
    expect(readMove({ say: 'no command' })).toBeNull();
    expect(readMove({ command: 'I wave', say: 'Hello!', ja: 'こんにちは！' })).toEqual({ command: 'I wave', say: 'Hello!', ja: 'こんにちは！' });
    expect(autopilotTurn([], '', 'companion')).toContain('Your voice:');
    expect(autopilotTurn([], '', 'plain')).not.toContain('Your voice:');
  });
});
