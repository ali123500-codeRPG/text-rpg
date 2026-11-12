// BG-73: crossing a frontier the Weaver builds that turn: the player's move event ends in the new zone, leaving the old one
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, ScriptedClaude } from '../harness';
import { resolveTurn } from '../../src/engine';
import { createDirector } from '../../src/agents/director';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';
import type { Intent } from '../../src/types';

describe('BG-73 frontier move event', () => {
  it('the move into a frontier reads as leaving for the zone built there', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const intent: Intent = { move: { toZone: 'woods' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null } as unknown as Intent;
    s.turn += 1;
    const events = resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    const client = new ScriptedClaude().push('weaver', grovePlan());
    const clock = new VirtualClock();
    await createDirector(clock).afterResolve(s, events, createRng(1), { client, clock, turn: s.turn, log: () => {} });
    expect(s.player.zone).not.toBe('field_far');
    const mv = events.find((e) => e.kind === 'move' && e.actorId === s.player.id)!;
    expect(mv.fromZone).toBe('field_far');
    expect(mv.zone).toBe(s.player.zone);
  });
});
