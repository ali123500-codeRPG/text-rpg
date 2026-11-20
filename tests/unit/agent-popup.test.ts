// Watch an agent play is a floating pop-up over the play screen, not a bar in the page: the header switch opens it, its head
// drags it, ✕ closes it and pauses the agent, and the agent's turns are still whole turns of the real game.
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';


describe('agent pop-up', () => {

  it('whole turn: a turn the agent sends is an ordinary whole turn', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const t = g.game.state()!.turn;
    await g.turn(intent({ action: { type: 'wait' } }));
    expect(g.game.state()!.turn).toBe(t + 1);
  });
});
