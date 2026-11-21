// 414 BG-1477: the hero's take of a pack from a body fell short (out of reach) two turns running. A bounty-chaser watching
// was told only "player wasted a young stranger", read it as a beating, and said "You've been hacking at a dead man for
// two turns now". An onlooker now hears what the try went for, and that it came to nothing.
import { expect, it } from 'vitest';
import { makeVillageResized } from '../harness';
import { intent, play } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { actorById } from '../../src/engine/relations';
import { boxOf } from '../../src/plan/geom';
import { zoneById } from '../../src/engine/relations';
import { buildOppositionView, earlierLine } from '../../src/views';

it('a take that falls short is seen by an onlooker as a try for the thing, never as a blow', () => {
  const s = makeVillageResized({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'patron_1'] }, 'field_mid', (r) => ({ ...r, w: 240 }));
  const c = boxOf(zoneById(s, 'field_mid')!.outline);
  const body = actorById(s, 'trader')!, onlooker = actorById(s, 'guard_1')!;
  for (const a of [body, onlooker]) { a.zone = 'field_mid'; a.placeId = s.player.placeId; }
  s.player.pos = { x: c.x - 100, y: c.y };
  body.pos = { x: c.x, y: c.y };
  onlooker.pos = { x: c.x - 50, y: c.y + 2 };
  body.core.condition.hpLostPct = 105; // down
  body.core.inventory.push({ id: 'pack_1', itemId: IT.sack });
  const ev = play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'pack_1', from: body.id }] }) });
  const short = ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')!;
  expect(short.perception[onlooker.id]?.level).toBe('full');
  const seen = buildOppositionView(s, onlooker.id).perceived.find((e) => e.id === short.id);
  expect(seen?.item).toBe('sack');
  const line = earlierLine(s, onlooker, short)!;
  expect(line).toMatch(/went for the sack on .+, and it came to nothing/);
  expect(line).not.toMatch(/wasted/);
});
