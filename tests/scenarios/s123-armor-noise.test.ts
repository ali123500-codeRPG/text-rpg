import { expect, it } from 'vitest';
import { makeVillage, place, createRng } from '../harness';
import { installRoutines } from '../../src/minds';
import { resolveTurn } from '../../src/engine';

// AN1–AN4: worn armor makes body-moving events louder by noise steps (light +0, medium +1, heavy +2)
function patrolNoise(armor: string | null) {
  const s = makeVillage({ playerZone: 'tav_common' });
  const g = place(s, 'guard_1', 'street_square');
  g.core.inventory = g.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
  if (armor) g.core.inventory.push({ id: 'worn', itemId: armor, equippedIn: ['armor'] });
  installRoutines(g, 'patrol_guard', { route: ['street_door', 'street_square'] }, 'route', s.turn, createRng(1));
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  return events.find((e) => e.kind === 'move' && e.actorId === g.id)!.noise;
}

it('123 Armor noise: a patrol walk is louder in heavier armor', () => {
  const base = patrolNoise(null);
  expect(patrolNoise('gambeson')).toBe(base);
  expect(patrolNoise('mail_hauberk')).not.toBe(base);
  const order = ['silent', 'faint', 'hushed', 'quiet', 'normal', 'loud', 'deafening'];
  expect(order.indexOf(patrolNoise('mail_hauberk'))).toBe(order.indexOf(base) + 1);
  expect(order.indexOf(patrolNoise('plate_harness'))).toBe(order.indexOf(base) + 2);
});
