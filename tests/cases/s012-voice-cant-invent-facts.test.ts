// Test 12: A Voice output sharing a fact outside knows is rejected and replaced.
import { describe, expect, it } from 'vitest';
import { readTurnRecord } from '../../src/save';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

describe('12 Voice can\'t invent facts', () => {
  it('a share outside knows is regenerated once; still bad, a neutral line replaces it', async () => {
    const { claude, game, state, store, start } = setupGame({ playerZone: 'tav_common' });
    state.actors.find((a) => a.id === 'trader')!.mind!.knows = [{ id: 'f_flood', text: 'The north road floods in spring.' }];
    start();
    const bad = { action: npcAction('talk', 'player'), line: 'The mayor hides gold in the mill.', volume: 'normal', shares: ['f_gold'], gear: null, stance: null, routine: null };
    claude.push('parser', speech('talk', 'trader', 'Any news?'));
    claude.push('voice', bad, { actorId: 'trader' }).push('voice', bad, { actorId: 'trader' });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('She shrugs.') });
    await game.submit('"Any news?"', { aimed: false });
    const log = game.gm().agentLog.find((l) => l.agent === 'voice')!;
    expect(claude.callsFor('voice')).toHaveLength(2);
    expect(log.status).toBe('fallback');
    expect(log.errors).toContain('invalid_share');
    expect(JSON.stringify(log.output)).not.toContain('f_gold');
    const record = await readTurnRecord(store, 'test', 1);
    expect(JSON.stringify(record!.events)).not.toContain('gold in the mill');
  });

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
