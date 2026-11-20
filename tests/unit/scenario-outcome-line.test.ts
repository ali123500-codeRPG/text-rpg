// The scenario-end pop-up says plainly what its ending means, under the ending's name: one fixed sentence per ending that
// names what happened and never what the scenario was about, so the hidden question and ending line stay hidden.
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { frameOf } from '../../src/engine/scenarioEnd';
import { SCENARIO_ENDINGS, SCENARIO_ENDING_OUTCOMES } from '../../src/types';


describe('scenario outcome line', () => {
  it('every ending has its own plain outcome sentence', () => {
    const lines = SCENARIO_ENDINGS.map((e) => SCENARIO_ENDING_OUTCOMES[e]);
    for (const l of lines) expect(l).toMatch(/^[A-Z].+\.$/);
    expect(new Set(lines).size).toBe(SCENARIO_ENDINGS.length);
  });

  it('a whole turn that ends the scenario carries the ending the line is read from, and the hidden ending line stays out', async () => {
    const g = wholeTurn();
    const here = g.state.player.zone;
    g.state.stage.scenario = frameOf(g.state, { question: 'Will the secret ledger be found?', scale: 'situation', endings: [{ when: { kind: 'reach', place: here }, as: 'resolved', text: 'the ledger is found' }] }, 'success', (_k, r) => r);
    await g.turn(intent({ action: { type: 'wait' } } as never));
    const line = g.game.lines().find((l) => l.scenarioEnd);
    expect(line?.scenarioEnd?.as).toBe('resolved');
    const outcome = SCENARIO_ENDING_OUTCOMES[line!.scenarioEnd!.as];
    expect(outcome).not.toMatch(/ledger/i);
  });
});
