import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { installRoutines } from '../../src/minds';
import { resolveTurn } from '../../src/engine';
import { buildNarrationView } from '../../src/views';

it('17 Patrol is heard: a partial move event, cue sound, no name', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const g = place(s, 'guard_1', 'street_square');
  // the beat's first stop is outside the tavern, linked to the player's zone without sight
  installRoutines(g, 'patrol_guard', { route: ['street_door', 'street_square'] }, 'route', s.turn, createRng(1));
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(g.zone).toBe('street_door');
  const nv = buildNarrationView(s, events);
  const move = nv.events.find((e) => e.kind === 'move' && e.level === 'partial');
  expect(move).toBeDefined();
  expect(move!.cue).toBe('sound');
  expect(move!.actor).toBeUndefined();
  expect(JSON.stringify(nv)).not.toContain(g.names.current);
});
