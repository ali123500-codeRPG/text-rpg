// Test 69: A Voice output naming a routine outside the actor's list is dropped; the current routine is kept; invalid_routine is logged.
import { describe, expect, it } from 'vitest';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

describe('69 Invalid switch', () => {
  it('the switch is dropped, the reply stands, the routine is unchanged', async () => {
    const { claude, game, state, start } = setupGame({ playerZone: 'tav_common' });
    const before = structuredClone(state.actors.find((a) => a.id === 'trader')!.mind!.routine);
    start();
    claude.push('parser', speech('talk', 'trader', 'Close up and come with me.'));
    claude.push('voice', { action: npcAction('talk', 'player'), line: 'Not tonight.', volume: 'normal', shares: [], gear: null, stance: null, routine: 'dance_all_night' }, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('"Not tonight."') });
    await game.submit('"Close up and come with me."', { aimed: false });
    const log = game.gm().agentLog.find((l) => l.agent === 'voice')!;
    expect(log.status).toBe('ok');
    expect(log.errors).toContain('invalid_routine');
    expect((log.output as { routine: string | null }).routine).toBeNull();
    expect(game.state()!.actors.find((a) => a.id === 'trader')!.mind!.routine).toEqual(before);
  });
});
