// BG-151 (run 86c t40): a trigger walked Pell into the kitchen, then the end-of-turn catch-up walked him straight back by
// his routine, with no move event for the doorway he crossed in 0 m: he was in two rooms in one turn and came back unseen.
// Anyone whose own order (an agent's or a trigger's) moved them keeps where it took them; a doorway underfoot is a leg too.
import { expect, it } from 'vitest';
import { byDoor, makeVillage } from '../harness';
import { play } from './w4-kit';
import { headTo } from '../../src/minds';
import type { Order } from '../../src/types';

const quiet = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });

it('a trigger\'s move is not undone by the catch-up', () => {
  const s = quiet();
  const m = s.actors.find((a) => a.id === 'patron_1')!;
  const fired: Order[] = [{ actorId: m.id, type: 'move', target: 'tav_counter', skill: null, intent: 'slips behind the bar', source: 'trigger', triggerId: 'x' }];
  play(s, { fired });
  expect(m.zone).toBe('tav_counter');
  expect(s.log.some((l) => l.code === 'caught_up' && l.detail?.actorId === m.id)).toBe(false);
});

it('a catch-up through a doorway right underfoot is a seen move', () => {
  const s = quiet();
  const m = byDoor(s, 'patron_1', 'tav_common', 'street_door', 0);
  headTo(s, m, 'street_square', 'weaver');
  const ev = play(s);
  expect(m.zone).not.toBe('tav_common');
  const out = ev.find((e) => e.actorId === m.id && e.kind === 'move' && e.fromZone === 'tav_common');
  expect(out?.perception[s.player.id]?.level).toBe('full');
});
