// 352 BG-282: in deck playtest run 14 the hero tried to Restrain a slime and slipped (a Critical Failure), but no roll line
// showed: the grab's contest was never put on its event, so the roll lines and the Rolls panel had nothing to show. A
// held one's try to break free had the same gap.
import { expect, it } from 'vitest';
import { actor, beside, createRng, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { mechanicsLines } from '../../src/agents/game';
import { breakFree } from '../../src/engine/held';

it('a restrain shows its grapple roll, and so does a try to break free', () => {
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_2'] });
  beside(s, 'guard_1', 'player', 0.5);
  const ev = play(s, { intent: intent({ action: { type: 'restrain', target: 'guard_1' } }) });
  const grab = ev.find((e) => e.actorId === 'player' && e.kind === 'restrain')!;
  expect(grab.contest).toBeDefined();
  expect(mechanicsLines(s, ev).some((l) => /^Your .* vs .*: (you win|a tie|.+ wins)$/.test(l))).toBe(true); // the grab (its skill, or one standing in)
  // a held one's move is its try to break free: that roll shows too
  actor(s, 'guard_1').heldBy = 'player';
  const bf = breakFree(s, actor(s, 'guard_1'), createRng(3));
  expect(bf?.contest).toBeDefined();
});
