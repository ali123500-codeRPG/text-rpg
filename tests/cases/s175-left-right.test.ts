// 175 From playtest run 38: two slimes an arm's length away stalled the player on "Which slime do you mean?" for
// "the nearest", "the one on the left" and "the one on the right" (BG-18); "the back of the cellar" came as awayFrom the
// cellar itself again (BG-19).
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { placeAll, sideFrom } from '../../src/engine/position';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

function mapped(playerZone: string): GameState {
  const s = makeVillage({ playerZone });
  const zs = s.places.flatMap((p) => p.zones);
  placeAll(s);
  return s;
}

describe('175 left and right (BG-18)', () => {
  it('ahead, left, right and behind come from the way the viewer last walked', () => {
    const me = { pos: { x: 0, y: 0 }, facing: [0, 1] as [number, number] }; // walked north
    expect(sideFrom(me, { x: 0, y: 2 })).toBe('ahead');
    expect(sideFrom(me, { x: -1, y: 0.5 })).toBe('left');
    expect(sideFrom(me, { x: 1, y: 0.5 })).toBe('right');
    expect(sideFrom(me, { x: 0.2, y: -3 })).toBe('behind');
    expect(sideFrom({ pos: { x: 0, y: 0 } }, { x: 1, y: 0 })).toBeNull(); // never walked: no left or right
  });

  it('a walk sets the facing, and the view says which side each one stands on', () => {
    const s = mapped('tav_common');
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common');
    play(s, { intent: intent({ move: { toZone: 'tav_common', spot: { side: 'north' } } }) });
    expect(s.player.facing).toBeDefined();
    const f = s.player.facing!, p = s.player.pos!;
    const l = place(s, 'slime_1', 'tav_common'), r = place(s, 'slime_2', 'tav_common');
    l.pos = { x: p.x - f[1] * 0.5, y: p.y + f[0] * 0.5 }; // a quarter turn anticlockwise: the left hand
    r.pos = { x: p.x + f[1] * 0.5, y: p.y - f[0] * 0.5 };
    const v = buildPlayerView(s);
    expect(v.actors.find((a) => a.id === 'slime_1')?.side).toBe('left');
    expect(v.actors.find((a) => a.id === 'slime_2')?.side).toBe('right');
  });

});

describe('175 the back of a zone (BG-19)', () => {
  it('awayFrom the zone itself becomes away from the way the player came in', () => {
    const s = mapped('tav_counter');
    play(s, { intent: intent({ move: { toZone: 'tav_cellar' } }) }); // the cellar here lies under the counter: its doorway is where the player stands
    expect(s.player.zone).toBe('tav_cellar');
    const v = buildPlayerView(s);
    expect(v.cameFrom?.[0]?.zone).toBe('tav_counter');
    const out = checkParserLegality(intent({ move: { toZone: 'tav_cellar', spot: { awayFrom: 'tav_cellar' } } }), v);
    expect(out.illegal).toEqual([]);
    expect(out.intent.move?.spot).toEqual({ awayFrom: 'tav_counter' });
  });

  it('"walk to the cellar steps" is a spot by the steps, not a move down them', () => {
    const s = mapped('tav_counter');
    const v = buildPlayerView(s);
    const out = checkParserLegality(intent({ move: { toZone: 'tav_counter', spot: { near: 'tav_cellar' } } }), v);
    expect(out.illegal).toEqual([]);
    play(s, { intent: out.intent });
    expect(s.player.zone).toBe('tav_counter');
  });
});
