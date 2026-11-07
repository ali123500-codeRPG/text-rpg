// Test 24: Explore and Tactical make the same sequence of calls after submit, and resolution never starts before the previous
// display plus BACKGROUND_WINDOW.
import { describe, expect, it } from 'vitest';
import type { ClaudeRequest } from '../../src/types';
import { CONFIG } from '../../src/config';
import { intent, narrateAll, npcAction, setupGame } from './_w7';

async function oneTurn(engaged: string[]) {
  const g = setupGame({ playerZone: 'gate_inner', engaged });
  for (const id of engaged) g.claude.push('planner', { action: npcAction('hold', null), dialogue: null, gear: null, stance: null, planUpdate: null }, { actorId: id, delayMs: 3000 });
  g.start();
  const displayedAt = g.clock.now();
  const before = g.claude.calls.length;
  let narratorAt = -1;
  g.claude.push('parser', intent(), { delayMs: 1000 });
  g.claude.pushResponse({ agent: 'narrator', response: (r: ClaudeRequest) => ((narratorAt = g.clock.now()), narrateAll('Time passes.')(r)) });
  await g.game.submit('I wait', { aimed: false });
  // a Planner call after the save is the next turn's background call, not part of this turn
  return { after: g.claude.calls.slice(before).filter((c) => c.agent !== 'planner').map((c) => c.agent), narratorAt, displayedAt };
}

describe('24 Same shape after submit', () => {
  it('Parser then Narrator in both modes; the Narrator (after resolution) never runs before display + BACKGROUND_WINDOW', async () => {
    const explore = await oneTurn([]);
    const tactical = await oneTurn(['guard_1']);
    expect(explore.after).toEqual(['parser', 'narrator']);
    expect(tactical.after).toEqual(explore.after);
    for (const t of [explore, tactical]) expect(t.narratorAt).toBeGreaterThanOrEqual(t.displayedAt + CONFIG.BACKGROUND_WINDOW_MS);
  });
});
