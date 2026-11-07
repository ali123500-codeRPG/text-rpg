// Test 39: Every full presence event appears in the Narrator's narrated list; a narration that omits one fails the fact check.
import { describe, expect, it } from 'vitest';
import type { AgentTurnLog, NarrationView } from '../../src/types';
import { callNarrator, factCheck, VirtualClock } from '../../src/agents';
import { ScriptedClaude } from '../harness';

const opening: NarrationView = {
  style: { tone: 'grounded low fantasy', length: '2 to 4 short paragraphs' },
  time: { day: 1, timeOfDay: 'Day' },
  events: [
    { id: 'ev_arrive', kind: 'arrival', level: 'full', cue: 'sight', actor: 'player', where: 'common room' },
    { id: 'ev_p1', kind: 'presence', level: 'full', cue: 'sight', actor: 'a tavern patron', activityLook: 'nursing a mug' },
    { id: 'ev_p2', kind: 'presence', level: 'full', cue: 'sight', actor: 'the barkeep', activityLook: 'wiping the counter' },
    { id: 'ev_p3', kind: 'presence', level: 'partial', cue: 'sound', where: 'down the cellar steps' },
  ],
  player: { name: 'Aldric', health: 'Unhurt', parts: [], zone: 'tav_common' },
  surroundings: [{ id: 'tav_common', name: 'common room', look: 'a low smoky room', cover: 'none', light: 'bright', links: [], groundItems: [] }],
  heard: [],
  actors: [{ label: 'a tavern patron', zone: 'tav_common', activityLook: 'nursing a mug' }, { label: 'the barkeep', zone: 'tav_counter', activityLook: 'wiping the counter' }],
  facts: [], headlines: [],
};

describe('39 Opening narration covers who is seen', () => {
  it('the fact check needs every full presence event; partial ones may be left out', () => {
    expect(factCheck({ text: 't', narrated: ['ev_arrive', 'ev_p1', 'ev_p2'] }, opening)).toEqual([]);
    expect(factCheck({ text: 't', narrated: ['ev_arrive', 'ev_p1'] }, opening)).toEqual(['missing_event:ev_p2']);
  });

  it('an omission is regenerated once; a second omission gives the fallback narration covering everyone seen', async () => {
    const clock = new VirtualClock();
    const claude = new ScriptedClaude(clock);
    const logs: AgentTurnLog[] = [];
    const ctx = { client: claude, clock, turn: 0, log: (e: AgentTurnLog) => logs.push(e) };
    const leak = { terms: [], names: [], ids: [] };
    claude.push('narrator', { text: 'You enter. A patron drinks.', narrated: ['ev_arrive', 'ev_p1'] });
    claude.push('narrator', { text: 'You enter. The barkeep wipes.', narrated: ['ev_arrive', 'ev_p1', 'ev_p2'] });
    const ok = await callNarrator(opening, ctx, leak);
    expect(ok.output.narrated).toContain('ev_p2');
    expect(logs[0].status).toBe('repaired');
    expect(claude.calls[1].input[1].content).toContain('missing_event:ev_p2');

    claude.push('narrator', { text: 'You enter.', narrated: ['ev_arrive'] }).push('narrator', { text: 'You enter.', narrated: ['ev_arrive'] });
    const fb = await callNarrator(opening, ctx, leak);
    expect(logs[1].status).toBe('fallback');
    expect(fb.output.narrated).toEqual(expect.arrayContaining(['ev_p1', 'ev_p2']));
    expect(fb.output.text.toLowerCase()).toContain('the barkeep');
  });
});
