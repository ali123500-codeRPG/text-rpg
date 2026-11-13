// BG-125: Wren slipped off and hid along the common-room wall; "walk over to Wren" (a spot near him) asked "Where in
// common room do you want to go?" four turns running. A spot near someone out of sight now walks to the point where
// the player last perceived them, never to where they really are.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { intent, play } from './w4-kit';
import { distM } from '../../src/engine/position';

it('BG-125: walking to someone last seen in the room goes where they were last seen', () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'guard_1'] });
  s.zones.find((z) => z.id === 'tav_common')!.rect = { x: 0, y: 0, w: 12, d: 8 };
  const w = place(s, 'patron_1', 'tav_common');
  w.pronouns = 'he';
  s.player.zone = 'tav_common'; s.player.pos = { x: -5, y: 0 };
  w.pos = { x: 4, y: 3 };
  play(s, { intent: intent({ action: { type: 'observe', target: null } }) }); // the player sees him there
  expect(s.player.journal!.lastSpot!.patron_1).toEqual({ x: 4, y: 3 });
  w.posture = 'stealthy'; w.pos = { x: 4, y: -3 }; delete s.player.journal!.clearSight!.patron_1; // he slips off unseen
  const v = buildPlayerView(s);
  expect(v.actors.some((a) => a.id === 'patron_1')).toBe(false);
  expect(v.lastSeen?.find((l) => l.id === 'patron_1')?.pronouns).toBe(w.pronouns); // BG-130: never guessed from the name
  const r = checkParserLegality({ ...intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1' } } }), action: null }, v);
  expect(r.illegal).toEqual([]);
  expect(r.intent.move!.spot).toMatchObject({ near: 'patron_1', lastSeen: true });
  play(s, { intent: r.intent });
  expect(distM(s, s.player, { zone: 'tav_common', pos: { x: 4, y: 3 } })).toBeLessThan(1.5);
});
