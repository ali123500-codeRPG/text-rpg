// Test 51: A deceive check reaches the dialogue call as an impression; the logged input contains no action type.
import { describe, expect, it } from 'vitest';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

const IMPRESSIONS = ['insulting, plainly false', 'unconvincing', 'doubtful but possible', 'convincing', 'very convincing', 'completely convincing'];

describe('51 Impression only', () => {
  it('the dialogue call gets one of the fixed impression words, never "deceive", a tier name or a number', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'tav_common' });
    start();
    claude.push('parser', speech('deceive', 'trader', 'The watch sent me for the cellar key.'));
    claude.push('voice', { action: npcAction('talk', 'player'), line: 'Did they now.', volume: 'normal', shares: [], gear: null, stance: null, routine: null }, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('She narrows her eyes.') });
    await game.submit('"The watch sent me for the cellar key."', { aimed: false });
    const sent = (game.gm().agentLog.find((l) => l.agent === 'voice')!.input as { content: string }[])[1].content;
    const impression = JSON.parse(sent.slice(sent.indexOf('IMPRESSION:\n') + 12)) as string[];
    expect(impression).toHaveLength(1);
    expect(IMPRESSIONS).toContain(impression[0]);
    expect(sent).not.toMatch(/deceive/i);
    expect(sent).not.toMatch(/Critical (Success|Failure)|"tier"|margin/);
  });
});
