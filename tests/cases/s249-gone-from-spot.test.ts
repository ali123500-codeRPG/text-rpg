// BG-164 (run 98b t15-18): Wren slipped out of the common room unseen. The player stood on the spot where they last saw him
// and spoke to him three turns running: the words went nowhere and the story never said he was gone. One rule: someone whose
// last-seen spot the player can see, empty, is gone from it (PlayerView lastSeen gone), and the Narrator is told when this
// turn's words, action or walk were for them (notThere), never where they went.
import { expect, it } from 'vitest';
import { intent, wholeTurn } from '../harness/turn';
import { beside, place } from '../harness';

const viewOf = (req: { input: { content: string }[] }, tag: string) => {
  const data = req.input[1].content;
  return JSON.parse(data.slice(data.indexOf(`${tag}:\n`) + tag.length + 2).split('\n\n')[0]);
};

it('words to someone gone from the spot where they were last seen: the view and the story say they are gone', async () => {
  const g = wholeTurn({ playerZone: 'tav_common' });
  beside(g.state, 'patron_1', 'player', 2);
  await g.turn(intent());
  expect(g.state.player.journal?.lastKnown?.patron_1).toBe('tav_common');
  place(g.state, 'patron_1', 'street_square'); // he slips out while nobody looks
  await g.turn(intent({ action: { type: 'talk', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' }, spoken: 'Wim, give it back.', addressees: ['patron_1'] }));
  const parse = g.claude.callsFor('parser').at(-1)!;
  const pv = viewOf(parse as never, 'PLAYER_VIEW');
  expect(pv.lastSeen.find((x: { id: string }) => x.id === 'patron_1')?.gone).toBe(true);
  const nv = viewOf(g.claude.callsFor('narrator').at(-1) as never, 'NARRATION_VIEW');
  expect(nv.notThere).toEqual([expect.stringContaining('last seen in')]);
});
