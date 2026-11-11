// 176 From playtest run 40 (BG-31): "walk to Tavern Lane, the street door" came as a move to the lane with a spot near the
// common room; the lane was out of view, so the spot couldn't be checked and the player was asked "Where in common room
// do you want to go?" twice. A spot on a move to another zone is only where to stop there: one that doesn't fit is dropped.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent } from './w4-kit';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';

describe('176 a spot in another zone (BG-31)', () => {
  it('a move to another zone with a spot that does not fit keeps the move and drops the spot', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const v = buildPlayerView(s);
    const to = v.zone.links[0].to;
    const out = checkParserLegality(intent({ move: { toZone: to, spot: { near: 'nobody_here' } } }), v);
    expect(out.illegal).toEqual([]);
    expect(out.intent.move?.toZone).toBe(to);
    expect(out.intent.move?.spot).toBeUndefined();
  });
  it('a spot that does not fit inside the current zone still asks where', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const v = buildPlayerView(s);
    const out = checkParserLegality(intent({ move: { toZone: 'tav_common', spot: { near: 'nobody_here' } } }), v);
    expect(out.illegal[0]).toMatch(/^move\.spot/);
  });
});
