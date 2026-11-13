// BG-139 (run 91, turns 38-40): Osric said "Follow me out, and keep your voice down" and stepped into the street. The
// next turn his routine took him back inside to his drink just as the player came out, so they swapped places and the
// player chased a man who was sitting indoors. Leading someone a single step (lead, no headTo) waits there like any lead.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { act, plannerOut, play } from './w4-kit';

it('BG-139: someone who leads you one step out waits there for you', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const o = s.actors.find((a) => a.id === 'patron_1')!;
  o.mind!.control = 'agent';
  play(s, { agentOutputs: [plannerOut(o.id, act('move', 'street_door'), { lead: s.player.id })] });
  o.mind!.control = 'code';
  expect(o.zone).toBe('street_door');
  play(s);
  expect(o.zone).toBe('street_door');
  expect(o.mind!.routine?.id).toBe('head_to');
});
