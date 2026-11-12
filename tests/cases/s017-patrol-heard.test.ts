import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { installRoutines } from '../../src/minds';
import { resolveTurn } from '../../src/engine';
import { buildNarrationView } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import { BK } from '../../src/library/tableIds';

// BG-57: footsteps outside a shut door 8 m off are lost under a quiet room's background; once the door is broken through
// (no sound lost, still no sight round it) the patrol is heard: a partial move event, cue sound, no name
const patrol = (broken: boolean) => {
  const s = makeVillage({ playerZone: 'tav_common' });
  if (broken) {
    (s.barriers ??= {}).front = { id: 'front', kind: BK.door, grade: 'minor', state: 'destroyed' };
    zoneById(s, 'tav_common')!.links.find((l) => l.to === 'street_door')!.barrier = 'front';
    zoneById(s, 'street_door')!.links.find((l) => l.to === 'tav_common')!.barrier = 'front';
  }
  const g = place(s, 'guard_1', 'street_square');
  // the beat's first stop is outside the tavern, linked to the player's zone without sight
  installRoutines(g, 'patrol_guard', { route: ['street_door', 'street_square'] }, 'route', s.turn, createRng(1));
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(g.zone).toBe('street_door');
  return { s, g, nv: buildNarrationView(s, events) };
};

it('17 Patrol is heard through a broken door, not through a shut one: a partial move event, cue sound, no name', () => {
  expect(patrol(false).nv.events.find((e) => e.kind === 'move')).toBeUndefined();
  const { g, nv } = patrol(true);
  const move = nv.events.find((e) => e.kind === 'move' && e.level === 'partial');
  expect(move).toBeDefined();
  expect(move!.cue).toBe('sound');
  expect(move!.actor).toBeUndefined();
  expect(JSON.stringify(nv)).not.toContain(g.names.current);
});
