// 323 TP2 ("Split player and NPC turns"): turns stay simultaneous, so a Planner's order can be stale by the
// time the NPC acts. An engaged NPC whose blow can no longer happen (its target dead or gone) does its combat-list action from
// what it sees then, instead of swinging at nothing; a held-back blow (yield, truce, spar) is still wasted, and the player's
// own stale blow is still wasted (TP3 is open).
import { expect, it } from 'vitest';
import { actor, beside, makeVillage, place } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';

const fight = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_2', 'guard_1'] });
  const p = actor(s, 'patron_1');
  p.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.control = 'agent';
  beside(s, 'patron_1', 'player', 1);
  const dead = place(s, 'slime_1', 'tav_common');
  dead.core.condition.hpLostPct = 150;
  return s;
};

it('an engaged NPC whose planned target is already dead turns on a foe it sees instead', () => {
  const s = fight();
  const ev = play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('attack', 'slime_1'))] });
  expect(ev.some((e) => e.actorId === 'patron_1' && e.kind === 'wasted')).toBe(false);
  expect(ev.some((e) => e.actorId === 'patron_1' && e.kind === 'attack' && e.target === 'player')).toBe(true);
  expect(s.log.some((l) => l.code === 'order_dropped' && l.detail?.actorId === 'patron_1')).toBe(true);
});

it("the player's blow at the dead is still wasted, and says why", () => {
  const s = fight();
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1' } }), agentOutputs: [plannerOut('patron_1', act('hold'))] });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('already_dead');
});
