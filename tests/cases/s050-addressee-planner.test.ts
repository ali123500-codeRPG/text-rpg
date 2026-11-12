// Test 50: On a dialogue intent the addressee's background Planner call is cancelled; on a clarify question it is kept.
import { describe, expect, it } from 'vitest';
import { intent, npcAction, speech, setupGame, narrateAll } from './_w7';

const hold = { action: npcAction('hold', null), dialogue: null, gear: null, stance: null, planUpdate: null };
const reply = { action: npcAction('talk', 'player'), line: 'Move along.', volume: 'normal', shares: [], gear: null, stance: null, routine: null };

describe('50 Addressee\'s Planner', () => {
  it('kept on a clarify question, cancelled (aborted, logged unused) on the dialogue intent', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'gate_inner', engaged: ['guard_1'] });
    claude.push('planner', hold, { actorId: 'guard_1', delayMs: 30_000 });
    start();
    const plannerReq = claude.callsFor('planner', 'guard_1')[0];

    claude.push('parser', intent({ action: null, clarify: 'Say what?' }));
    await game.submit('I tell him', { aimed: false });
    expect(plannerReq.signal?.aborted).toBe(false);

    claude.push('parser', speech('talk', 'guard_1', 'Open the gate.'));
    claude.push('voice', reply, { actorId: 'guard_1' }).pushResponse({ agent: 'narrator', response: narrateAll('"Move along."') });
    await game.submit('"Open the gate."', { aimed: false });
    expect(plannerReq.signal?.aborted).toBe(true);
    const log = game.gm().agentLog;
    expect(log.find((l) => l.agent === 'planner' && l.actorId === 'guard_1')!.status).toBe('unused');
    expect(log.some((l) => l.agent === 'voice' && l.actorId === 'guard_1')).toBe(true);
  });
});
