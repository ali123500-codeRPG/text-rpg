// BG-146 (run 100): Marta's Weaver beat had her quietly offer the player 40 coin, but she was code-run, so no Responder wrote
// the words and her speak event carried no line ("her words swallowed by the murmur"). Every owner of a speech beat at
// the player gets a Responder call for its words, code-run or agent-run, as when the player speaks to them.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { beatSpeakers } from '../../src/engine';

it('BG-146: a code-run owner of a speech beat still gets its words written', () => {
  const s = makeVillage();
  const t = s.actors.find((a) => a.id === 'trader')!;
  t.mind!.control = 'code';
  s.scratch = { ...s.scratch, firedOrders: [{ actorId: t.id, type: 'talk', target: s.player.id, skill: null, intent: 'offer the job', source: 'trigger' }] };
  expect(beatSpeakers(s, [])).toEqual([t.id]);
  expect(beatSpeakers(s, [t.id])).toEqual([]); // already answering the player
});
