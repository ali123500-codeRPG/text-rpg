// Test 13: After a clarify question: turn unchanged, no events; when the player answers, the turn resolves with the Planner
// outputs logged before it, within one session.
import { describe, expect, it } from 'vitest';
import { intent, npcAction, setupGame, narrateAll } from './_w7';

describe('13 Clarify keeps Planners', () => {
  it('the Planner output from before the question applies once the turn resolves', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'gate_inner', engaged: ['guard_1'] });
    const order = { action: npcAction('hold', null, { intent: 'bar the gate' }), dialogue: null, gear: null, stance: null, planUpdate: null };
    claude.push('planner', order, { actorId: 'guard_1', delayMs: 500 });
    start();
    claude.push('parser', intent({ action: null, clarify: 'Which guard do you mean?' }));
    await game.submit('I deal with him', { aimed: false });
    expect(game.state()!.turn).toBe(1);
    expect(game.state()!.events).toEqual([]);
    expect(game.lines().at(-1)).toMatchObject({ kind: 'clarify', text: 'Which guard do you mean?' });

    let plannerCallsAtAnswer = -1;
    claude.pushResponse({ agent: 'parser', response: () => ((plannerCallsAtAnswer = claude.callsFor('planner').length), { ok: true, value: intent() }) });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('The guard bars the gate.') });
    await game.submit('I watch the guard', { aimed: false });
    expect(plannerCallsAtAnswer).toBe(1); // no new Planner call for the same turn
    const log = game.gm().agentLog.find((l) => l.agent === 'planner')!;
    expect(log.status).toBe('ok');
    expect(log.output).toMatchObject({ action: { intent: 'bar the gate' } });
    expect(game.state()!.turn).toBe(2);
  });
});
