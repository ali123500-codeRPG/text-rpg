// Test 80: /aim (the Aim button) sets aimed for one turn only. Since BG-200 (BF26) the Parser may also mark an attack
// aimed when the player's words aim at a part (tests/cases/s282); a top-level aimed is still stripped, and the turn
// record's aimed is the button's.
import { describe, expect, it } from 'vitest';
import { readTurnRecord } from '../../src/save';
import { checkIntent } from '../../src/agents';
import { intent, setupGame, narrateAll } from './_w7';
import { SK } from '../../src/library/skillIds';

const attack = (over: Record<string, unknown> = {}) =>
  intent({ action: { type: 'attack', skill: SK.melee_medium, target: 'guard_1', targetPart: 'head', item: null, mode: null, approach: 'a cut at the head', stance: 'normal', ...over } });

describe('80 Aim is code-set', () => {
  it('a top-level "aimed" from the Parser is stripped by the schema; the action keeps its own (BG-200)', () => {
    const r = checkIntent({ ...attack({ aimed: true }), aimed: true });
    expect(r.errors).toEqual([]);
    expect(r.value).not.toHaveProperty('aimed');
    expect(r.value.action?.aimed).toBe(true);
  });

  it('/aim marks the next turn only; the record keeps the button, not the Parser', async () => {
    const { claude, game, store, start } = setupGame({ playerZone: 'gate_inner' });
    start();
    // the guard's shield would block where its parry used to, and the head cut of turn 2 would kill it before turn 3
    const guard = game.gm().state!.actors.find((a) => a.id === 'guard_1')!;
    guard.core.skills[SK.parry] = { raw: 50, state: 'normal' };
    guard.core.standingDefense = 'parry';
    game.gm().state!.player.core.skills[SK.resolve] = { raw: 100, state: 'normal' }; // nerve holds for the three turns, whatever the dice
    // turn 1: the Parser claims aimed at no part (a top-level claim too); no toggle -> not aimed
    claude.push('parser', { ...attack({ aimed: true, targetPart: null }), aimed: true }).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('I aim at his head', { aimed: false });
    // turn 2: /aim -> aimed
    await game.submit('/aim', { aimed: false });
    claude.push('parser', attack()).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('I cut at his head', { aimed: false });
    // turn 3: reset after the turn resolved
    claude.push('parser', attack()).pushResponse({ agent: 'narrator', response: narrateAll('You swing.') });
    await game.submit('again', { aimed: false });
    const aimed = await Promise.all([1, 2, 3].map(async (t) => (await readTurnRecord(store, "test", t))!.aimed));
    expect(aimed).toEqual([false, true, false]);
    const parsed = game.gm().agentLog.find((l) => l.agent === 'parser')!.output as { aimed?: boolean };
    expect(parsed).not.toHaveProperty('aimed');
  });
});
