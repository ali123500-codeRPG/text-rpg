// 195 From playtest run 46 (BG-47): "push the tavern door open and look inside" with a look as the action walked one move
// slot along a 40 m street and stopped short of the door, but the Narrator put the player at the threshold, twice. A leg that
// stops short of the way into the zone it heads for now says how far that way still is (toGo).
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scenario/geometry';
import { placeAll } from '../../src/engine/position';
import { buildNarrationView } from '../../src/views';
import { NARRATOR_INSTRUCTIONS } from '../../src/agents/prompts';
import { CONFIG } from '../../src/config';

it('BG-47: a leg that stops short of the door says how many metres are still to go', () => {
  const s = makeVillage({ playerZone: 'street_door' });
  const zs = s.places.flatMap((p) => p.zones);
  for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, zs);
  placeAll(s);
  const street = zs.find((z) => z.id === 'street_door')!.rect!, room = zs.find((z) => z.id === 'tav_common')!.rect!;
  s.player.pos = { x: street.x + Math.sign(street.x - room.x) * (street.w / 2 - 0.5), y: street.y + Math.sign(street.y - room.y) * (street.d / 2 - 0.5) };
  const ev = play(s, { intent: intent({ move: { toZone: 'tav_common' }, action: { type: 'observe', target: null } }) });
  expect(s.player.zone).toBe('street_door');
  const v = buildNarrationView(s, ev, null);
  const mv = v.events.find((e) => ev.some((g) => g.id === e.id && g.kind === 'move' && g.actorId === s.player.id))!;
  expect(mv.heading).toBe('common room');
  expect(mv.toGo).toBeGreaterThan(0);
  expect(NARRATOR_INSTRUCTIONS).toContain('toGo');
});
