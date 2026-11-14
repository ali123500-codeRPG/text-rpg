// 311 Speech in character: the agent bar's "In character" style speaks and plays from the player character's personality line, and
// signatures set on the Character page join that line (and so reach the narrator, and the Planner and Responder for an NPC).
import { describe, expect, it, vi } from 'vitest';
import { ScriptedClaude, makeVillage } from '../harness';
import { intent, wholeTurn } from '../harness/turn';
import { createGame, VirtualClock, type ScenarioDirector } from '../../src/agents';
import { memoryStore, saveTurn } from '../../src/save';
import { openBugs } from '../../src/save/bugs';
import { VOICE_STYLES, autopilotTurn } from '../../src/agents/autopilot';
import { personalityText, setSignatures } from '../../src/ruleset/personality';
import { guidedPrompt } from '../../src/agents/crossroads';
import { actorById } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import type { GameState, TurnRecord } from '../../src/types';

const rec = (s: GameState): TurnRecord => ({ storyId: s.storyId, turn: s.turn, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
const idle: ScenarioDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };

describe('311 speech in character', () => {
  it('signatures are cleaned: trimmed, blanks dropped, capped in number and length; none left removes them', () => {
    const s = makeVillage(), p = s.player;
    setSignatures(p, ['  Calls everyone   "friend". ', '', 'x'.repeat(500), ...Array(10).fill('Never draws first.')]);
    expect(p.core.signatures?.[0]).toBe('Calls everyone "friend".');
    expect(p.core.signatures?.[1]).toHaveLength(CONFIG.SIGNATURE_MAX_CHARS);
    expect(p.core.signatures).toHaveLength(CONFIG.SIGNATURES_MAX);
    setSignatures(p, [' ', '']);
    expect(p.core.signatures).toBeUndefined();
  });

  it('an actor\'s own signatures join its personality line, for the player and for an NPC', () => {
    const s = makeVillage(), npc = actorById(s, 'patron_1')!;
    setSignatures(s.player, ['Hums when nervous.']);
    setSignatures(npc, ['Never pays first.']);
    expect(personalityText(s, s.player, 'Steady')).toContain('Hums when nervous.');
    expect(personalityText(s, npc, 'Steady')).toContain('Never pays first.');
  });

  it('"In character" gives the agent who the character is, signatures included, over the playstyle; Plain does not', () => {
    const s = makeVillage();
    setSignatures(s.player, ['Calls everyone "friend".']);
    expect(VOICE_STYLES.some(([id]) => id === 'character')).toBe(true);
    const turn = autopilotTurn([], '', 'character', [], undefined, s);
    expect(turn).toContain('You ARE the player character');
    expect(turn).toContain('Who you are: Nerve:');
    expect(turn).toContain('Calls everyone "friend".');
    expect(turn).toContain('who they are wins'); // SP2 b: the personality steers moves over the playstyle
    expect(autopilotTurn([], '', 'plain', [], undefined, s)).not.toContain('Who you are:');
  });

  it('BG-232: signatures are habits, not lines to recite; in character they are given once, not again in the guided part', () => {
    const s = makeVillage();
    setSignatures(s.player, ['Says "steady now" when things go wrong.']);
    const turn = autopilotTurn([], '', 'character', [], { state: s, ctx: {} }, s);
    expect(turn).toContain('never on two moves running');
    expect(turn).not.toContain('keep to it');
    expect(turn.split('steady now').length - 1).toBe(1); // in the personality line only
    expect(guidedPrompt(s, [], {})).toContain('not lines to repeat');
    expect(autopilotTurn([], '', 'plain', [], { state: s, ctx: {} }, s)).toContain('steady now'); // Plain still keeps to them
  });

  it('BG-232: what a command had the character say aloud joins the said list the agent must not repeat', async () => {
    const clock = new VirtualClock(), store = memoryStore();
    const claude = new ScriptedClaude(clock).push('autopilot', { command: 'I tell the barkeep "Steady now, friend."', say: '' }).push('autopilot', { command: 'I wait', say: 'Quiet.' });
    const g = createGame({ client: claude, clock, store, director: idle });
    await g.agentMove('', 'character');
    await g.agentMove('', 'character');
    expect(claude.callsFor('autopilot')[1].input[1].content).toContain('signature sayings included):\n- Steady now, friend.');
  });

  it('BG-232: a line the agent says word for word again within its last few moves is filed as a bug', async () => {
    const clock = new VirtualClock(), store = memoryStore(), s = makeVillage();
    await saveTurn(store, s, rec(s));
    const claude = new ScriptedClaude(clock).push('autopilot', { command: 'I tell the barkeep "Steady now, friend."', say: '' })
      .push('autopilot', { command: 'I wait', say: 'Quiet.' }).push('autopilot', { command: 'I wait', say: 'steady now, friend!' });
    const g = createGame({ client: claude, clock, store, director: idle });
    expect(await g.resume()).toBe(true);
    await g.agentMove('', 'character');
    await g.agentMove('', 'character');
    expect((await openBugs(store)).some((b) => b.code === 'agent_repeat')).toBe(false);
    await g.agentMove('', 'character');
    await vi.waitFor(async () => expect((await openBugs(store)).find((b) => b.code === 'agent_repeat')?.line).toBe('steady now, friend!'));
  });

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

  it('whole turn: signatures set in play reach the narrator with the player character\'s personality', async () => {
    const t = wholeTurn();
    t.game.setSignatures(['Hums when nervous.']);
    await t.turn(intent());
    expect(t.claude.callsFor('narrator')[0].input[1].content).toContain('Hums when nervous.');
  });
});
