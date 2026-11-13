// AT49 on the play screen: the player's walk still on its way shows in the action box and on the Map, with the metres
// and seconds left, while the view carries it; a turn with no order carries the walk on, any other order ends it and the box empties.
import { describe, expect, it } from 'vitest';
import { walkLeft } from '../../src/ui/doing';
import { buildPlayerView } from '../../src/views';
import { wholeTurn, intent } from '../harness/turn';

describe('AT49 the move order on the play screen', () => {
  it('what is left reads in metres and seconds; a goal with no open way has no distance', () => {
    expect(walkLeft({ toZone: 'z', to: 'the yard', metres: 24, seconds: 17 })).toBe('24 m · 17 s to go');
    expect(walkLeft({ toZone: 'z', to: 'the road', metres: 1450, seconds: 1036 })).toBe('1.5 km · 17 min 16 s to go');
    expect(walkLeft({ toZone: 'z', to: 'the cellar', metres: Infinity, seconds: Infinity })).toBe('no open way there');
  });

  it('whole turn: the walk shows while on its way, and a turn with no order carries it on', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.walking = { toZone: 'street_square' };
    const w = buildPlayerView(s).player.walking!;
    expect(w).toMatchObject({ toZone: 'street_square' });
    expect(w.to.length).toBeGreaterThan(0);
    expect(w.metres).toBeGreaterThan(0);
    expect(Number.isFinite(w.seconds)).toBe(true);
    await g.turn(intent({ action: null }), 'I keep walking to the square');
    expect(s.player.zone).toBe('street_square'); // carried on by itself
    const after = buildPlayerView(s).player.walking;
    if (after) expect(after.metres).toBeLessThan(w.metres);
  });

  it('whole turn: any other order ends the walk', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.walking = { toZone: 'street_square' };
    await g.turn(intent({ action: { type: 'wait', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } }), 'I stop and wait here');
    expect(s.player.zone).toBe('tav_common');
    expect(buildPlayerView(s).player.walking).toBeUndefined();
  });
});
