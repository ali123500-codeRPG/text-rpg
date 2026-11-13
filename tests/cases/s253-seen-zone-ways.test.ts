// BG-169 (replay run 77d step 24): from the back lane, Kettle Street is in sight with its way "up the street toward the
// square"; "go up toward the square" was refused, since only the player's own ways, zones in view and known places could be
// named. One rule: a way out of any zone in sight is a place the player can name, and the walk finds the way there.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';

it('every way out of a zone in sight can be named as a move', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const v = buildPlayerView(s);
  const beyond = v.zones.flatMap((z) => z.links.map((l) => l.to)).filter((id) => id !== v.zone.id && !v.zone.links.some((l) => l.to === id) && !v.zones.some((z) => z.id === id));
  expect(beyond.length).toBeGreaterThan(0);
  for (const to of beyond) expect(checkParserLegality(intent({ move: { toZone: to } }), v).illegal).toEqual([]);
});
