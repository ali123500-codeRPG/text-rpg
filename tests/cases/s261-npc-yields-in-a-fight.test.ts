// BG-177 (run 97f t31-41): Wen, held by the player in a real fight, said "Enough, I yield" with yields set, but an NPC's
// yields only ever left a spar (invalid_spar_yield), so the fight went on and Bram killed him. One rule: an NPC's yield in a
// real fight surrenders, as a surrender from fear does (DEFEATED); in a spar it still leaves the spar. Sibling: grabbing
// someone one already holds is wasted as already_holding, not already_held (told as someone else's grip).
import { expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { stance } from '../../src/engine/relations';

const fight = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const p = actor(s, 'patron_1');
  p.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.control = 'agent';
  beside(s, 'patron_1', 'player', 1);
  return s;
};

it("an NPC's yield in a real fight is a surrender", () => {
  const s = fight();
  // the patron swings first (the player's own blows, two a turn, could down him before he can yield)
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('attack', 'player'))] });
  play(s, { intent: intent(), agentOutputs: [plannerOut('patron_1', act('hold'), { yields: true, dialogue: { spoken: 'Enough, I yield!', volume: 'normal', addressees: ['player'] } })] });
  const codes = s.log.map((l) => l.code);
  expect(codes).not.toContain('invalid_spar_yield');
  expect(actor(s, 'patron_1').mind!.moraleState).toBe('surrendered');
  expect(stance(s, actor(s, 'patron_1'), s.player)).toBe('yielded');
});

it('grabbing someone one already holds says so', () => {
  const s = fight();
  actor(s, 'patron_1').heldBy = 'player';
  const ev = play(s, { intent: intent({ action: { type: 'restrain', target: 'patron_1' } }), agentOutputs: [plannerOut('patron_1', act('hold'))] });
  expect(ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('already_holding');
});
