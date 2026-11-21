// 419 Who holds back (D-205 b, PQ16 b, BG-1550): a code-run NPC on the cautious Nerve line, unless armed and skilled, or one
// unarmed with no fighting skill of HOLD_BACK_BELOW, never closes in: it strikes only a foe in its strike reach, else flees.
import { expect, it } from 'vitest';
import { TP } from '../../src/library/templateIds';
import { createRng, makeVillage, place } from '../harness';
import { equipLoadout, spawnNpc } from '../../src/library/spawn';
import { IT } from '../../src/library/itemIds';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { holdsBack } from '../../src/ruleset/personality';
import { placeAll } from '../../src/engine/position';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';

it('419 a Careful, bare-fisted headman flees a slime it would have closed in on; one that is armed and skilled closes in', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const h = spawnNpc(s, TP.headman, { id: 'headman', zone: 'field_edge', placeId: 'field', bandId: 'villagers', name: 'Oswin' }, createRng(7));
  h.mind!.control = 'code';
  s.actors.push(h);
  placeAll(s);
  place(s, 'slime_1', 'field_mid');
  h.mind!.overrides = { slime_1: 'hostile' };
  h.mind!.knowledge.slime_1 = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  expect(holdsBack(s, h)).toBe(true);
  expect(fallbackOrder(buildActorView(s, 'headman'), createRng(1))).toMatchObject({ type: 'flee', source: 'fallback' });
  // a slime already within its strike reach: it strikes
  const sl = s.actors.find((a) => a.id === 'slime_1')!;
  place(s, 'slime_1', 'field_edge');
  sl.pos = { x: h.pos!.x + 0.5, y: h.pos!.y };
  expect(fallbackOrder(buildActorView(s, 'headman'), createRng(1))).toMatchObject({ type: 'attack', target: 'slime_1' });
  // armed with a fighting skill at the bar: cautious or not, it closes in
  place(s, 'slime_1', 'field_mid');
  h.core.inventory.push(...equipLoadout(s, [IT.arming_sword], 'headman'));
  h.core.skills[SK.melee_medium] = { raw: CONFIG.HOLD_BACK_BELOW, state: 'normal' };
  expect(holdsBack(s, h)).toBe(false);
  expect(fallbackOrder(buildActorView(s, 'headman'), createRng(1))).toMatchObject({ type: 'move', target: 'field_mid' });
});
