// BG-225 and BG-226 (playtest, turn 44): the player crossed the square's frontier onto the east road. The road was placed
// before the frontier was joined to it, so it had no placed zone to sit beside and went east of everything, a gap from the
// square it links to; and the player, moved into it with no point, stood at the road's middle, a kilometre on. A frontier is
// joined before its zones are placed, so they touch the zone it was on, and the player stands a step inside the way in.
import { expect, it } from 'vitest';
import type { StagePlan } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan } from '../../src/scenario/apply';
import { grovePlan } from '../../src/scenario/fixtures';
import { zoneById } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';

it('BG-225/226: a road built at a frontier touches the zone it leads from, and the player arrives at its near end', () => {
  const s = makeVillage({ playerZone: 'field_far' });
  const roadKind = Object.entries(getLibrary().zoneKinds ?? {}).find(([, k]) => k.road)![0];
  const p: StagePlan = grovePlan();
  // as the Weaver wrote it: the road names only the ways on; the way back to the field is added by code
  p.zones = [{ key: 'east_road', place: 'field', kind: roadKind, name: 'the east road', look: 'a cart road', length: 2, links: [{ to: 'deep_woods', label: 'on toward the market town', sight: true }] }];
  const from = zoneById(s, 'field_far')!.rect!;
  applyStagePlan(s, p, { kind: 'extension', tier: 'success', placeId: 'field', frontierKey: 'woods' }, { entry: 'open' }, createRng(1));
  const road = s.zones.find((z) => z.name === 'the east road')!;
  const r = road.rect!;
  // BG-225: the two rectangles share an edge
  const gapX = Math.max(0, Math.abs(r.x - from.x) - (r.w + from.w) / 2), gapY = Math.max(0, Math.abs(r.y - from.y) - (r.d + from.d) / 2);
  expect(gapX + gapY).toBe(0);
  // BG-226: the player is on the road, a step from where it meets the field, not at its middle
  expect(s.player.zone).toBe(road.id);
  const pos = s.player.pos!;
  const edgeDist = Math.min(Math.abs(pos.x - (r.x - r.w / 2)), Math.abs(pos.x - (r.x + r.w / 2)), Math.abs(pos.y - (r.y - r.d / 2)), Math.abs(pos.y - (r.y + r.d / 2)));
  expect(edgeDist).toBeLessThanOrEqual(CONFIG.ENTER_M + 0.01);
  expect(Math.hypot(pos.x - r.x, pos.y - r.y)).toBeGreaterThan(100);
});
