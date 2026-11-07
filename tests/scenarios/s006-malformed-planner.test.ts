// Test 6: Malformed Planner output: the game continues with combat lists and routines and logs the failure.
import { describe, expect, it } from 'vitest';
import { intent, setupGame, narrateAll } from './_w7';

describe('6 Malformed Planner output', () => {
  it('one repair, then the combat list; the turn resolves and the failure is logged', async () => {
    const { claude, game, start } = setupGame({ playerZone: 'gate_inner', engaged: ['guard_1'] });
    claude.push('planner', { action: 'charge!' }, { actorId: 'guard_1' }).push('planner', { orders: [] }, { actorId: 'guard_1' });
    start();
    claude.push('parser', intent()).pushResponse({ agent: 'narrator', response: narrateAll('The guard comes at you.') });
    await game.submit('I watch the guard', { aimed: false });
    const log = game.gm().agentLog.find((l) => l.agent === 'planner')!;
    expect(log.status).toBe('fallback');
    expect(log.errors).toContain('schema');
    expect(log.rawOutputs).toHaveLength(2);
    expect(game.state()!.turn).toBe(2); // the turn resolved
    expect(game.lines().at(-1)!.kind).toBe('narration');
  });
});
