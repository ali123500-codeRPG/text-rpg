// Test 80: The Parser output never carries aimed; /aim sets it for one turn only.
import { describe, expect, it } from 'vitest';
import { readTurnRecord } from '../../src/save';
import { checkIntent } from '../../src/agents';
import { intent, setupGame, narrateAll } from './_w7';
import { SK } from '../../src/library/skillIds';

const attack = (over: Record<string, unknown> = {}) =>
  intent({ action: { type: 'attack', skill: SK.melee_medium, target: 'guard_1', targetPart: 'head', item: null, mode: null, approach: 'a cut at the head', stance: 'normal', ...over } });

describe('80 Aim is code-set', () => {
  it('an "aimed" field from the Parser is stripped by the schema', () => {
    const r = checkIntent({ ...attack({ aimed: true }), aimed: true });
    expect(r.errors).toEqual([]);
    expect(JSON.stringify(r.value)).not.toContain('aimed');
  });

  it('/aim marks the next turn only; the Parser\'s claim never does', async () => {
    const { claude, game, store, start } = setupGame({ playerZone: 'gate_inner' });
    start();
    // turn 1: the Parser claims aimed; no toggle -> not aimed
    claude.push('parser', { ...attack({ aimed: true }), aimed: true }).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('I aim at his head', { aimed: false });
    // turn 2: /aim -> aimed
    await game.submit('/aim', { aimed: false });
    claude.push('parser', attack()).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('I cut at his head', { aimed: false });
    // turn 3: reset after the turn resolved
    claude.push('parser', attack()).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('again', { aimed: false });
    const aimed = await Promise.all([1, 2, 3].map(async (t) => (await readTurnRecord(store, 'test', t))!.aimed));
    expect(aimed).toEqual([false, true, false]);
    const parsed = game.gm().agentLog.find((l) => l.agent === 'parser')!.output;
    expect(JSON.stringify(parsed)).not.toContain('aimed');
  });
});
