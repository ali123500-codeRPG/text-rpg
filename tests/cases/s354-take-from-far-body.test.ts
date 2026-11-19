// 354 BG-284: in deck playtest run 16 the hero chose "Take the pack from the young stranger", a body 19 m along the
// causeway. Each turn only walked 8 m (the move time; the take does not use the main time), filed invalid_gear as if the
// order were broken, and the pack came off on the third turn. A take with nothing else to do now runs on with the main
// time, as a dash does; one still short says how far and waits for next turn, with no bug filed.
import { expect, it } from 'vitest';
import { beside, makeVillageResized } from '../harness';
import { intent, play } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { distM } from '../../src/engine/position';
import { slotMetres } from '../../src/engine/speed';
import { zoneById } from '../../src/engine/relations';
import { boxOf } from '../../src/plan/geom';

const bodyAt = (m: number) => {
  // the field a long open stretch, 240 m, like the causeway
  const s = makeVillageResized({ playerZone: 'field_mid', without: ['slime_2', 'guard_1', 'trader', 'patron_1'] }, 'field_mid', (r) => ({ ...r, w: 240 }));
  const field = zoneById(s, 'field_mid')!;
  const t = beside(s, 'slime_1', 'player', 0.5);
  s.player.pos = { x: boxOf(field.outline).x - 110, y: boxOf(field.outline).y };
  t.pos = { x: s.player.pos.x + m, y: boxOf(field.outline).y };
  t.core.condition.hpLostPct = 105; // down
  t.core.inventory.push({ id: 'pack_1', itemId: IT.sack });
  return { s, t };
};
const take = (s: ReturnType<typeof bodyAt>['s'], from: string) => play(s, { intent: intent({ gear: [{ op: 'pick_up', item: 'pack_1', from }] }) });

it('a body 15 m off is reached and its pack taken in one turn, with no bug filed', () => {
  const { s, t } = bodyAt(15);
  take(s, t.id);
  expect(s.player.core.inventory.some((i) => i.id === 'pack_1')).toBe(true);
  expect(s.log.some((l) => l.code === 'invalid_gear')).toBe(false);
});

it('a body too far for one run: the hero runs on, the story says how far short, and no bug is filed', () => {
  const { s, t } = bodyAt(100);
  const ev = take(s, t.id);
  expect(s.player.core.inventory.some((i) => i.id === 'pack_1')).toBe(false);
  // BF91: as far as a dash runs (the move time walked, then the main time run), not a walk's 8 m
  expect(100 - distM(s, s.player, t)).toBeCloseTo(slotMetres(s, s.player, 'move') + slotMetres(s, s.player, 'main'), 0);
  const short = ev.find((e) => e.actorId === 'player' && e.kind === 'wasted')!;
  expect(short.reason).toBe('out_of_reach');
  expect(short.metres).toBeGreaterThan(0);
  expect(s.log.some((l) => l.code === 'invalid_gear')).toBe(false);
  expect(s.log.some((l) => l.code === 'pick_up_short')).toBe(true);
  for (let i = 0; i < 4 && !s.player.core.inventory.some((x) => x.id === 'pack_1'); i++) take(s, t.id); // later turns get there
  expect(s.player.core.inventory.some((i) => i.id === 'pack_1')).toBe(true);
});
