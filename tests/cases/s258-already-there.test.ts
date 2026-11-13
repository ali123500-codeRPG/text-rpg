// BG-174 (run 97e t35-38): "walk east with Wen" in Mill Lane, whose east end has no way on: once at the east side, each
// such move took no step and the turn was a silent wait. One rule: a move that takes no step, nothing stopping it, tells
// the Narrator where the player already stands (stayedPut, rule 28), who says so and names the ways out.
import { expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';

const viewOf = (req: { input: { content: string }[] }) => {
  const data = req.input[1].content;
  return JSON.parse(data.slice(data.indexOf('NARRATION_VIEW:\n') + 16).split('\n\n')[0]);
};

it('a walk to the side the player already stands on is told, not a silent wait', async () => {
  const g = wholeTurn({ playerZone: 'field_mid', without: ['slime_1', 'slime_2'] });
  const east = intent({ move: { toZone: 'field_mid', spot: { side: 'east' } }, action: null });
  await g.turn(east);
  await g.turn(east);
  const nv = viewOf(g.claude.callsFor('narrator').at(-1) as never);
  expect(nv.stayedPut).toContain('east side');
});
