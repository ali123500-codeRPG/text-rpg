// BG-142 (runs 93, 89b): a search that found nothing carried no effect and no roll, so the story never said whether
// anything turned up. Every search now ends in an outcome; nothing found reads the same whether nothing was there or it
// was missed, and a person not held is only looked over, which the outcome says.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { buildNarrationView } from '../../src/views';

it('BG-142: a search that finds nothing says so', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening; // BF68: the patron sleeps through the morning; in the evening it drinks at its seat
  const ev = play(s, { intent: intent({ action: { type: 'search', target: null } }) }).find((e) => e.kind === 'search')!;
  expect(ev.effects).toContainEqual(expect.objectContaining({ kind: 'found_nothing', actorId: s.player.id }));
  expect(JSON.stringify(buildNarrationView(s, [ev], null))).toContain('finds nothing here');
  const on = play(s, { intent: intent({ action: { type: 'search', target: 'patron_1' } }) }).find((e) => e.kind === 'search')!;
  expect(on.effects).toContainEqual(expect.objectContaining({ kind: 'found_nothing', actorId: 'patron_1', data: expect.objectContaining({ on: true, held: false }) }));
  expect(JSON.stringify(buildNarrationView(s, [on], null))).toContain('needs a hold on them');
});
