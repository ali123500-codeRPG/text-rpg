// Test 11: An ordinary and a guarded conversation make the same number of calls in the same order, and show results at the same time.
import { describe, expect, it } from 'vitest';
import { npcAction, speech, setupGame, narrateAll } from './_w7';

async function converse(guarded: boolean) {
  const g = setupGame({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] }); // no wandering slime engages the guard (a next-turn background Planner)
  if (guarded) g.state.hidden.secrets.push({ id: 'sec_cellar', holderId: 'trader', fact: 'smuggled goods in the cellar', leakTerms: ['smuggled'], revealWhen: { type: 'check_passed', skill: 'persuasion', minTier: 2, againstActorId: 'trader' } });
  g.start();
  g.claude.push('parser', speech('talk', 'trader', 'Quiet night?'), { delayMs: 1000 });
  const reply = { action: npcAction('talk', 'player'), gear: null, stance: null };
  // the guarded call is slower; DIALOGUE_WINDOW hides the difference
  if (guarded) g.claude.push('responder', { ...reply, dialogue: { line: 'Quiet enough.', volume: 'normal' }, planUpdate: null, reveals: [] }, { actorId: 'trader', delayMs: 4000 });
  else g.claude.push('voice', { ...reply, line: 'Quiet enough.', volume: 'normal', shares: [], routine: null }, { actorId: 'trader', delayMs: 1500 });
  g.claude.pushResponse({ agent: 'narrator', response: narrateAll('"Quiet enough," she says.'), delayMs: 2000 });
  await g.game.submit('"Quiet night?"', { aimed: false });
  return { agents: g.claude.calls.map((c) => (c.agent === 'responder' || c.agent === 'voice' ? 'dialogue' : c.agent)), shownAt: g.clock.now() };
}

describe('11 Same dialogue shape', () => {
  it('same calls, same order, same display time', async () => {
    const ordinary = await converse(false);
    const guarded = await converse(true);
    expect(ordinary.agents).toEqual(['parser', 'dialogue', 'narrator']);
    expect(guarded.agents).toEqual(ordinary.agents);
    expect(guarded.shownAt).toBe(ordinary.shownAt);
  });
});
