// 186 RPG Voice: the agent's commentary carries an acting note and a few sound tags for the RPG Voice connector; the
// screen and Claude's voices get the line without them, and any failure of the connector says why and falls back.
import { describe, expect, it } from 'vitest';
import { plainLine, readMove } from '../../src/agents/autopilot';

describe('186 RPG Voice', () => {

  it('a move keeps the voice’s own tags, drops any other markup, and reads the acting note', () => {
    const m = readMove({ command: 'I strike the guard', say: '<GASP> He <b>missed</b>! <short pause> <dance> Again!', direction: 'breathless <x>, then fierce' })!;
    expect(m.say).toBe('<gasp> He missed! <short pause> Again!');
    expect(m.direction).toBe('breathless, then fierce');
    expect(plainLine(m.say)).toBe('He missed! Again!');
    expect(readMove({ command: 'I wait', say: 'Hm.' })!.direction).toBeUndefined();
  });

});
