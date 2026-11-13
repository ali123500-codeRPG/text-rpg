// BF2e (BF2e1 a, BF2e2 a, BF2e3 a, BF2e4 c): over a long turn (a rest, a trade, a wait) people move on with the clock.
// The player is told only what they would perceive by the normal rules, awake; one line per person, legs in order, up
// to LONG_TURN_LINES lines, the rest "others came and went". Asleep, nothing.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { headTo } from '../../src/minds';
import { buildNarrationView } from '../../src/views';
import { CONFIG } from '../../src/config';

const resting = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  headTo(s, s.actors.find((a) => a.id === 'patron_1')!, 'street_square', 'weaver');
  return s;
};
const rest = intent({ action: { type: 'rest' } });

it('a rest sums up who came and went, as the player saw it', () => {
  const s = resting();
  const ev = play(s, { intent: rest });
  const legs = ev.filter((e) => e.actorId === 'patron_1' && e.kind === 'move');
  expect(legs.length).toBeGreaterThan(0);
  expect(legs.every((e) => e.summed)).toBe(true);
  const v = buildNarrationView(s, ev);
  expect(v.events.some((e) => legs.some((l) => l.id === e.id))).toBe(false);
  expect(v.cameAndWent).toEqual([expect.stringMatching(/^(Old Wim|a .*) went from common room into outside the tavern/)]);
});

it('past LONG_TURN_LINES the rest are others coming and going', () => {
  const s = resting();
  CONFIG.LONG_TURN_LINES = 0;
  expect(buildNarrationView(s, play(s, { intent: rest })).cameAndWent).toEqual(['others came and went']);
});
