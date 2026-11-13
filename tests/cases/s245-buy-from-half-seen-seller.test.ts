// BG-155 (run 97b): the barkeep, who had quoted four copper for a meal, was only half seen across the common room, so
// her entry listed no wares; a buy from her was asked about again and again and never happened. A seller the player has
// seen is still known to sell: lastSeen carries her wares, a buy may name her, and the walk steps up to her to buy.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { zoneById } from '../../src/engine/relations';
import { SV } from '../../src/library/serviceIds';

it('a half-seen seller the player knows can be bought from', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
  place(s, 'trader', 'tav_common').wares = { items: [], services: [SV.drink] };
  zoneById(s, 'tav_common')!.light = 'dark';
  (s.player.journal ??= {} as never).lastKnown = { trader: 'tav_common' };
  const v = buildPlayerView(s);
  expect(v.actors.find((a) => a.id === 'trader')?.level).toBe('partial');
  const ware = `service:${SV.drink}`;
  expect(v.lastSeen?.find((l) => l.id === 'trader')?.wares?.some((w) => w.id === ware)).toBe(true);
  const i = intent({ action: { type: 'buy', target: 'trader', item: ware } });
  expect(checkParserLegality(i, v).illegal).toEqual([]);
  const ev = play(s, { intent: i });
  expect(ev.some((e) => e.kind === 'buy')).toBe(true);
});
