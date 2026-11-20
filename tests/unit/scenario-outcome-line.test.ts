// The scenario-end pop-up says plainly what its ending means, under the ending's name: one fixed sentence per ending that
// names what happened and never what the scenario was about, so the hidden question and ending line stay hidden.
import { describe, expect, it } from 'vitest';
import { SCENARIO_ENDINGS, SCENARIO_ENDING_OUTCOMES } from '../../src/types';


describe('scenario outcome line', () => {
  it('every ending has its own plain outcome sentence', () => {
    const lines = SCENARIO_ENDINGS.map((e) => SCENARIO_ENDING_OUTCOMES[e]);
    for (const l of lines) expect(l).toMatch(/^[A-Z].+\.$/);
    expect(new Set(lines).size).toBe(SCENARIO_ENDINGS.length);
  });

});
