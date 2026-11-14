// 158 Watch an agent play: one story per owner (the player's and the autopilot agent's own save), each resumed on its own;
// the autopilot's move is one command plus one short line of commentary.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { AUTOPILOT_BRIEF, autopilotTurn, readMove } from '../../src/agents/autopilot';
import type { GameState, TurnRecord } from '../../src/types';
import { SK } from '../../src/library/skillIds';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };
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

  it('BG-63: no switching stories while an opening is still being written', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    await saveTurn(store, story('mine', '2026-11-10T10:00:00Z'), rec(story('mine', '2026-11-10T10:00:00Z')));
    const g = createGame({ client: new ScriptedClaude(clock), clock, store, director: idle });
    const build = { name: 'Wren', skills: { [SK.melee_medium]: 50, [SK.parry]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.riposte]: 20 }, tagged: [SK.melee_medium, SK.parry, SK.endurance] };
    void g.newStory(build, { owner: 'agent' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(g.busy()).toBe(true);
    await expect(g.resume('player')).rejects.toThrow('still being written');
    expect(g.state()?.meta.owner).toBe('agent'); // the opening keeps its own story
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
    expect(readMove({ command: 'I wave', say: 'Hello!', ja: 'こんにちは！' })).toEqual({ command: 'I wave', say: 'Hello!' }); // nothing but its own fields
    expect(autopilotTurn([], '', 'character')).toContain('Your voice:');
    expect(autopilotTurn([], '', 'plain')).not.toContain('Your voice:');
    expect(autopilotTurn([], '', 'plain', ['Yatta! Got him.'])).toContain('- Yatta! Got him.'); // never repeats itself
    const v = makeVillage();
    v.player.core.condition.hpLostPct = 50;
    expect(autopilotTurn([], '', '', [], undefined, v)).toContain('How you are right now (you always know this; never stop to check it): health Wounded'); // BG-26: every move
  });

  it('BG-25/BG-26: the agent acts instead of looking at its sheet', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const claude = new ScriptedClaude(clock)
      .push('autopilot', { command: '/inv', say: 'What do I have?' })
      .push('autopilot', { command: '/quests', say: 'And my jobs?' })
      .push('autopilot', { command: 'I strike her', say: 'Now!' })
      .push('autopilot', { command: '/stats', say: 'How bad am I hurt?' })
      .push('autopilot', { command: 'I strike again', say: 'Again!' });
    const g = createGame({ client: claude, clock, store, director: idle });
    expect((await g.agentMove())?.command).toBe('/inv');
    expect((await g.agentMove())?.command).toBe('I strike her'); // a second look so soon is asked again
    expect(claude.callsFor('autopilot')[2].input[1].content).toContain('do not check it now');
    expect((await g.agentMove())?.command).toBe('I strike again'); // BG-26: /stats is never needed, so it is always asked again
  });

  it('attack commands: /strike with no target says how; /aim /strike sends an aimed "I strike …" turn', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    await saveTurn(store, story('mine', '2026-11-10T10:00:00Z'), rec(story('mine', '2026-11-10T10:00:00Z')));
    const claude = new ScriptedClaude(clock);
    const g = createGame({ client: claude, clock, store, director: idle });
    await g.resume();
    await g.submit('/strike', { aimed: false });
    expect(g.lines().at(-1)?.text).toContain('/strike needs someone to attack');
    void g.submit('/aim /strike the guard at his left leg', { aimed: false }).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(g.lines().find((l) => l.kind === 'player')).toMatchObject({ text: 'I strike the guard at his left leg', aimed: true });
  });

  it('BG-183: the agent is told to stop asking for the same thing after two tries and find another way', () => {
    expect(AUTOPILOT_BRIEF).toMatch(/Never ask for the same thing more than twice/);
    expect(AUTOPILOT_BRIEF).toMatch(/try another way/);
  });

  it('BG-30: every move the agent is told the ways out it can see, so it never invents a door', () => {
    const v = makeVillage({});
    const p = autopilotTurn([], '', '', [], undefined, v);
    expect(p).toContain('Where you are: the common room. Ways out you can see from here: behind the bar; out the front door');
    expect(p).toContain('never head for a door, stair or path that isn\'t listed');
  });
});
