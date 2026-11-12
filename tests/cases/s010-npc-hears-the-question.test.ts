// Test 10: In a dialogue turn, each spokesperson's logged input contains that turn's spoken words and never the player's
// action type, move or approach.
import { describe, expect, it } from 'vitest';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

describe('10 NPC hears the question', () => {
  it('spoken words in; action type, move and approach out', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'tav_common' });
    start();
    claude.push('parser', { ...speech('deceive', 'trader', 'Is the cellar door locked at night?', { approach: 'sidling toward the steps' }), move: { toZone: 'tav_counter' } });
    claude.push('voice', { action: npcAction('talk', 'player'), line: 'Always.', volume: 'normal', shares: [], gear: null, stance: null, routine: null }, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('She eyes you.') });
    await game.submit('Sidling toward the steps I ask "Is the cellar door locked at night?"', { aimed: false });
    const dialogueLogs = game.gm().agentLog.filter((l) => l.agent === 'voice' || l.agent === 'responder');
    expect(dialogueLogs).toHaveLength(1);
    const sent = (dialogueLogs[0].input as { content: string }[])[1].content;
    expect(sent).toContain('Is the cellar door locked at night?');
    expect(sent).not.toContain('deceive');
    expect(sent.toLowerCase()).not.toContain('sidling');
    expect(sent).not.toContain('toZone');
  });
});
