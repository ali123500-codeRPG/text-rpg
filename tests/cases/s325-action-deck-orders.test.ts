// AD7: an order code built from a clicked action plays its turn with no Parser call, and passes the same checks.
import { describe, expect, it } from 'vitest';
import { intent, setupGame, narrateAll } from '../harness/turn';

describe('AD7 clicked actions skip the Parser', () => {
  it('a code-built order naming someone not in view is turned away like a Parser one (a question, no turn); a good one plays a whole turn without asking the Parser, the line the action name', async () => {
    const g = setupGame();
    g.claude.defaults.narrator = narrateAll();
    g.start();
    const t = g.game.state()!.turn;
    const bad = intent({ action: { type: 'attack', skill: '', target: 'nobody_here', targetPart: null, item: null, mode: null, approach: '' } });
    await g.game.act({ intent: bad, line: 'Attack' }, { aimed: false });
    await g.game.settle();
    expect(g.game.state()!.turn).toBe(t);
    expect(g.game.lines().at(-1)?.kind).toBe('clarify');
    await g.game.act({ intent: intent(), line: 'Look around' }, { aimed: false });
    await g.game.settle();
    expect(g.game.state()!.turn).toBe(t + 1);
    expect(g.claude.callsFor('parser')).toHaveLength(0);
    expect(g.game.lines().filter((l) => l.kind === 'player').map((l) => l.text)).toEqual(['Attack', 'Look around']);
  });
});
