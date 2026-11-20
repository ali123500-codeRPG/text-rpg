// Test 12: A Voice output sharing a fact outside knows is rejected and replaced.
import { describe, expect, it } from 'vitest';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

describe('12 Voice can\'t invent facts', () => {

  it('a share inside knows is accepted', async () => {
    const { claude, game, state, start } = setupGame({ playerZone: 'tav_common' });
    state.actors.find((a) => a.id === 'trader')!.mind!.knows = [{ id: 'f_flood', text: 'The north road floods in spring.' }];
    start();
    claude.push('parser', speech('talk', 'trader', 'Any news?'));
    claude.push('voice', { action: npcAction('talk', 'player'), line: 'The north road floods in spring.', volume: 'normal', shares: ['f_flood'], gear: null, stance: null, routine: null }, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('She warns you about the road.') });
    await game.submit('"Any news?"', { aimed: false });
    expect(game.gm().agentLog.find((l) => l.agent === 'voice')!.status).toBe('ok');
  });
});
