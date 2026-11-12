// 165 The player's trail: the places it last left, newest first (CONFIG.TRAIL_ZONES long), so the parser reads "go back".
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import { intent, play } from './w4-kit';

describe('165 go back', () => {
  it('each move the player makes puts the zone it left first on the trail, and the parser sees it as cameFrom', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    expect(buildPlayerView(s).cameFrom).toBeUndefined();
    play(s, { intent: intent({ move: { toZone: 'street_square' } }) });
    expect(s.player.zone).toBe('street_square');
    const v = buildPlayerView(s);
    expect(v.cameFrom?.[0]).toMatchObject({ zone: 'street_door', name: 'outside the tavern' });
    play(s, { intent: intent({ move: { toZone: 'gate_inner' } }) });
    expect(buildPlayerView(s).cameFrom?.map((x) => x.zone)).toEqual(['street_square', 'street_door']);
  });
  it('the trail holds TRAIL_ZONES places, a revisited place moves to the front, and staying put adds nothing', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    for (const z of ['street_square', 'gate_inner', 'street_square', 'gate_inner', 'field_edge']) play(s, { intent: intent({ move: { toZone: z } }) });
    play(s, { intent: intent({}) });
    const trail = s.player.journal!.trail!.map((x) => x.zone);
    // left: door, square, gate, square, gate → gate and square once each, newest first
    expect(trail).toEqual(['gate_inner', 'street_square', 'street_door'].slice(0, CONFIG.TRAIL_ZONES));
  });
});
