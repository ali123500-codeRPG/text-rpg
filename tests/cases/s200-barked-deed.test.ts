// BG-59: words said beside a deed are a bark, but the deed still counts: the receiver of a gift remembers it. BF67: the bark is
// real speech, so the receiver, who heard it, has the words too.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildActorView } from '../../src/views';
import { pruneRecent } from '../../src/agents/game';
import { IT } from '../../src/library/itemIds';
import { actorById } from '../../src/engine/relations';

it('BG-59: a gift given with a question stays in the receiver\'s view, with the words it heard (BF67)', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 20 });
  actorById(s, 'patron_1')!.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] }; // they have been talking
  const ev = play(s, { intent: intent({ action: { type: 'give', target: 'patron_1', item: 'purse', qty: 1 }, spoken: 'What have you seen tonight?', addressees: ['patron_1'] }) });
  const give = ev.find((e) => e.kind === 'offer')!; // BF34: held out, with the words
  expect(give.bark).toBe(true);
  s.recentEvents = pruneRecent(s, ev);
  s.events = [];
  const seen = buildActorView(s, 'patron_1').perceived.find((e) => e.kind === 'offer');
  expect(seen).toBeDefined();
  expect((seen as { line?: { text: string } }).line?.text).toBe('What have you seen tonight?');
});
