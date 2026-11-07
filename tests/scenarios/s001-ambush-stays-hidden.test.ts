// Test 1: A guard's ambush trigger is set on the bridge; over the turns before it springs, the Narrator's text contains none of its terms.
import { describe, expect, it } from 'vitest';
import { sentText } from '../harness';
import { intent, narrateAll, setupGame } from './_w7';

const TERMS = ['ambush', 'lying in wait', 'trap at the gate'];

describe('1 Ambush stays hidden', () => {
  it('no ambush term reaches the Narrator or the screen, even when the Narrator tries', async () => {
    const { claude, game, state, start } = setupGame({ playerZone: 'street_square' });
    state.hidden.plans.guard_1 = {
      goal: 'take the stranger at the gate', steps: ['wait at the gate'], createdTurn: 0,
      triggers: [{ id: 'tr_ambush', ownerId: 'guard_1', when: { type: 'player_seen_in_zone', zone: 'gate_inner' }, then: { type: 'attack', target: '$player', skill: 'melee_medium', intent: 'spring the ambush' }, once: true }],
    };
    state.hidden.secrets.push({ id: 'sec_ambush', holderId: 'guard_1', fact: 'the guard is lying in wait', leakTerms: ['ambush', 'lying in wait'], revealWhen: { type: 'event_in_zone', kind: 'attack', zone: 'gate_inner' } });
    state.hidden.stage.hiddenTerms = ['trap at the gate'];
    start();

    // turn 1: the Narrator leaks, then complies on the one regeneration
    claude.push('parser', intent());
    claude.pushResponse({ agent: 'narrator', response: narrateAll('You sense an ambush at the gate.') });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('The square is quiet; the well creaks.') });
    await game.submit('I look toward the gate', { aimed: false });
    // turn 2: the Narrator leaks twice; the templated fallback is shown
    claude.push('parser', intent());
    claude.pushResponse({ agent: 'narrator', response: narrateAll('A guard is lying in wait.') });
    claude.pushResponse({ agent: 'narrator', response: narrateAll('A trap at the gate, surely.') });
    await game.submit('I wait by the well', { aimed: false });

    const narration = game.lines().filter((l) => l.kind === 'narration');
    expect(narration).toHaveLength(2);
    const shown = narration.map((l) => l.text).join('\n').toLowerCase();
    for (const t of TERMS) expect(shown).not.toContain(t);
    for (const c of [...claude.callsFor('narrator'), ...claude.callsFor('parser')])
      for (const t of TERMS) expect(sentText(c).toLowerCase()).not.toContain(t);
  });
});
