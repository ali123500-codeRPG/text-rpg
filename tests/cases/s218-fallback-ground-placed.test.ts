// BG-126: crossing a frontier whose build failed gave the fallback's empty zone no kind, size or rectangle, and the next
// turn crashed ("zone north_road has no rectangle"). The fallback ground is now open ground placed like any built zone.
import { expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { ScenarioDirector } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';

it('BG-126: the fallback ground past a frontier has a rectangle, and a turn there resolves', async () => {
  const s = makeVillage({ playerZone: 'field_far', without: ['slime_1', 'slime_2', 'patron_1'] });
  const d = new ScenarioDirector({ weave: async () => null, clock: new VirtualClock() });
  await d.cross(s, 'woods', createRng(1));
  const z = zoneById(s, s.player.zone)!;
  expect(z.id).not.toBe('field_far');
  expect(z.rect).toBeDefined();
  expect(() => play(s, { intent: intent({ move: { toZone: 'field_far' }, action: { type: 'observe', target: null } }) })).not.toThrow();
});
