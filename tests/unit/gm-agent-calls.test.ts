// The GM view's People table marks who an agent runs; clicking a name shows that person's last agent calls, newest first,
// read from this turn and the kept turn records (CONFIG.GM_AGENT_CALLS_SHOWN of them at most).
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { wholeTurn, intent } from '../harness/turn';

describe('the GM view: last agent calls for one person', () => {
  it('whole turn: an agent-run guard in a fight has its calls listed newest first, older turns included, capped', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'], engaged: ['guard_1'] });
    const guard = g.game.state()!.actors.find((a) => a.id === 'guard_1')!;
    expect(guard.mind?.control).toBe('agent');
    for (let i = 0; i < 7; i++) await g.turn(intent(), 'I wait');
    const calls = await g.game.agentHistory('guard_1');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(CONFIG.GM_AGENT_CALLS_SHOWN);
    expect(calls.every((c) => c.actorId === 'guard_1')).toBe(true);
    for (let i = 1; i < calls.length; i++) expect(calls[i].turn).toBeLessThanOrEqual(calls[i - 1].turn);
    expect(calls.some((c) => c.turn < g.game.state()!.turn - 1)).toBe(true); // older turns come from the saved records
    expect(await g.game.agentHistory('nobody_here')).toEqual([]);
  });
});
