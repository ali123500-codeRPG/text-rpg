// Test 2: A Planner call's logged input has no trace of that turn's player text; a dialogue call's logged input has only that
// turn's spoken words and impressions.
import { describe, expect, it } from 'vitest';
import { intent, npcAction, speech, setupGame, narrateAll } from './_w7';

describe('2 Simultaneous turns', () => {
  it('the Planner never sees the player text; the dialogue call sees only the words and the impression', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'tav_common', engaged: ['guard_1'] });
    claude.push('planner', { action: npcAction('hold', null), dialogue: null, gear: null, stance: null, planUpdate: null }, { actorId: 'guard_1' });
    start();
    claude.push('parser', intent({ action: { ...intent().action!, approach: 'humming pumpernickel' } }));
    claude.pushResponse({ agent: 'narrator', response: narrateAll('You wait.') });
    await game.submit('I hum pumpernickel softly', { aimed: false });
    const plannerInputs = game.gm().agentLog.filter((l) => l.agent === 'planner').map((l) => JSON.stringify(l.input));
    expect(plannerInputs.length).toBeGreaterThan(0);
    for (const s of plannerInputs) expect(s).not.toMatch(/pumpernickel/i);

    claude.push('parser', speech('persuade', 'trader', 'Tell me about the flood, friend.', { approach: 'leaning on the bar', stance: 'reckless' }));
    claude.push('voice', { action: npcAction('talk', 'player'), line: 'Floods every spring.', volume: 'normal', shares: [], gear: null, stance: null, routine: null }, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('The barkeep shrugs.') });
    await game.submit('Leaning on the bar, I ask: "Tell me about the flood, friend."', { aimed: false });
    // the turn's input (the fixed instructions name every NPC action type, persuade included)
    const voiceIn = JSON.stringify((game.gm().agentLog.find((l) => l.agent === 'voice')!.input as { content: string }[]).slice(1));
    expect(voiceIn).toContain('Tell me about the flood, friend.');
    expect(voiceIn).toContain('IMPRESSION');
    for (const s of ['leaning on the bar', 'reckless', 'persuade', 'pumpernickel']) expect(voiceIn.toLowerCase()).not.toContain(s);
  });
});
