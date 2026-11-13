// TQ5: the whole-turn helper plays a real turn (views, agents, resolve, narration) with defaults for every agent.
import { describe, expect, it } from 'vitest';
import { beside, sentText } from '../harness';
import { intent, speech, wholeTurn } from '../harness/turn';
import { TURN_CHECK } from '../../src/save/turnCheck';

describe('wholeTurn (TQ5)', () => {
  it('one call plays a whole turn: the Parser intent resolves, NPCs answer on their code minds, the Narrator narrates', async () => {
    const t = wholeTurn();
    beside(t.state, 'patron_1');
    const { events, narration } = await t.turn(speech('talk', 'patron_1', 'Seen anything odd tonight?'));
    expect(events.some((e) => e.actorId === 'player' && e.kind === 'speak')).toBe(true);
    expect(narration).not.toBe('');
    const reply = events.find((e) => e.actorId === 'patron_1' && e.kind === 'speak'); // the patron answers on its code mind
    expect(reply).toBeDefined();
    expect(sentText(t.claude.callsFor('narrator')[0])).toContain(`"id":"${reply!.id}"`);
    expect(t.game.state()!.turn).toBe(t.state.turn);
  });

  it('a turn that does not advance (a clarify) throws instead of returning the last narration', async () => {
    const t = wholeTurn();
    await expect(t.turn(intent({ action: null, clarify: 'Who do you mean?' }))).rejects.toThrow(/did not advance/);
  });

  it('in the game (not strict), a broken world rule is filed as a turn_check bug and the turn still finishes', async () => {
    TURN_CHECK.strict = false;
    try {
      const t = wholeTurn();
      t.state.actors.find((a) => a.id === 'patron_1')!.bandId = 'nobody'; // links_real breaks
      const { narration } = await t.turn(intent());
      expect(narration).not.toBe('');
      const bugs = await t.game.openBugs();
      expect(bugs.some((b) => b.code === 'turn_check' && JSON.stringify(b).includes('links_real'))).toBe(true);
    } finally {
      TURN_CHECK.strict = true;
    }
  });
});
