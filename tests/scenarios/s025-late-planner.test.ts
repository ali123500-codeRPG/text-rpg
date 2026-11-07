// Test 25: A Planner call not back by BACKGROUND_WINDOW gives that actor its type's combat list, discards the whole output
// and logs planner_late.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { readTurnRecord } from '../../src/save';
import { intent, npcAction, setupGame, narrateAll } from './_w7';

describe('25 Late Planner', () => {
  it('late output discarded whole (planUpdate included), planner_late logged, the actor still acts', async () => {
    const { claude, game, store, start } = setupGame({ playerZone: 'gate_inner', engaged: ['guard_1'] });
    claude.push('planner', {
      action: npcAction('flee', 'street_square'), dialogue: { line: 'I yield!', volume: 'shout' }, gear: null, stance: null,
      planUpdate: { goal: 'run home', steps: [], triggers: [], memoryNote: 'scared', routine: null },
    }, { actorId: 'guard_1', delayMs: CONFIG.BACKGROUND_WINDOW_MS + 5000 });
    start();
    claude.push('parser', intent()).pushResponse({ agent: 'narrator', response: narrateAll('The guard squares up.') });
    await game.submit('I wait', { aimed: false });
    const log = game.gm().agentLog.find((l) => l.agent === 'planner' && l.actorId === 'guard_1')!;
    expect(log.status).toBe('late');
    expect(log.errors).toContain('planner_late');
    const s = game.state()!;
    expect(s.hidden.plans.guard_1).toBeUndefined();
    expect(s.hidden.memory.guard_1).toBeUndefined();
    const record = await readTurnRecord(store, s.storyId, 1);
    expect(record!.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(record!.events)).not.toContain('I yield!');
  });
});
