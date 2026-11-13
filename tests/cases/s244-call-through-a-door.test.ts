// BG-147 (runs 98, 99, 86c; calling out to someone you can only hear through a door needs to work):
// words to someone known to be about but out of sight were refused as an unknown addressee, or put off to "go to them
// first". Speech reach follows hearing, not sight: anyone the player knows is about can be called to, and whoever hears
// it answers (selectSpokespeople); the Parser says it now, loud enough to carry, and never defers words beside a move.
import { expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent } from './w4-kit';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { selectSpokespeople } from '../../src/engine';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';

it('a shout through a door reaches someone out of sight who hears it', () => {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  place(s, 'patron_1', 'tav_cellar');
  (s.player.journal ??= {} as never).lastKnown = { patron_1: 'tav_cellar' };
  const v = buildPlayerView(s);
  expect(v.actors.some((a) => a.id === 'patron_1' && a.level === 'full')).toBe(false);
  const i = intent({ action: { type: 'talk', target: 'patron_1' }, spoken: 'Wim! Come up here!', volume: 'shout', addressees: ['patron_1'] });
  expect(checkParserLegality(i, v).illegal).toEqual([]);
  expect(selectSpokespeople(s, i)).toEqual(['patron_1']);
  expect(PARSER_INSTRUCTIONS).toContain('Calling out to someone without going to them is speech now, never deferred');
});
