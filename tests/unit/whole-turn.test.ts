// TQ5: the whole-turn helper plays a real turn (views, agents, resolve, narration) with defaults for every agent.
import { describe, expect, it } from 'vitest';
import { beside, sentText } from '../harness';
import { speech, wholeTurn } from '../harness/turn';

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
});
