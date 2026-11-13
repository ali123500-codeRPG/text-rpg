// 279 Following someone (BG-190): a walk with spot near someone and follow set keeps after them. Reaching them does not
// end it; it carries on by itself (AT49) toward where they are now while the player can see or hear them, a sneak with no
// move sneaks along it, and when the player loses them it ends and the PlayerView says why, once.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { intent, play } from './w4-kit';
import type { GameState } from '../../src/types';

const quiet = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const follow = (s: GameState) => intent({ move: { toZone: s.actors.find((a) => a.id === 'patron_1')!.zone, spot: { near: 'patron_1', follow: true } } });
const patron = (s: GameState) => s.actors.find((a) => a.id === 'patron_1')!;

describe('279 following someone', () => {
  it('a follow reaches them and carries on; when they move on, the next turn with no order goes after them', () => {
    const s = quiet();
    place(s, 'patron_1', 'tav_common');
    play(s, { intent: follow(s) });
    expect(s.player.walking?.spot).toMatchObject({ near: 'patron_1', follow: true });
    expect(buildPlayerView(s).player.following).toEqual({ who: 'patron_1', name: expect.any(String) });
    place(s, 'patron_1', 'tav_counter'); // the patron steps up to the counter, in sight
    play(s, { intent: intent() }); // "continue"
    expect(s.player.zone).toBe('tav_counter');
    expect(s.player.walking?.toZone).toBe('tav_counter');
  });
  it('a sneak with no move sneaks along the follow', () => {
    const s = quiet();
    place(s, 'patron_1', 'tav_common');
    play(s, { intent: follow(s) });
    place(s, 'patron_1', 'tav_counter');
    play(s, { intent: intent({ action: { type: 'sneak' } }) });
    expect(s.player.zone).toBe('tav_counter');
    expect(s.player.walking?.spot?.follow).toBe(true);
  });
  it('lost from sight, the follow ends and the view says so the next turn only', () => {
    const s = quiet();
    place(s, 'patron_1', 'tav_common');
    play(s, { intent: follow(s) });
    place(s, 'patron_1', 'field_far'); // gone, out of sight and earshot
    play(s, { intent: intent() });
    expect(s.player.walking).toBeUndefined();
    expect(buildPlayerView(s).player.following).toMatchObject({ who: 'patron_1', lost: 'out_of_sight' });
    expect(s.log.some((l) => l.code === 'follow_lost')).toBe(true);
    play(s, { intent: intent() });
    expect(buildPlayerView(s).player.following).toBeUndefined();
  });
  it('seen going down, the follow ends: down', () => {
    const s = quiet();
    place(s, 'patron_1', 'tav_common');
    play(s, { intent: follow(s) });
    patron(s).core.condition.hpLostPct = 100;
    play(s, { intent: intent() });
    expect(s.player.walking).toBeUndefined();
    expect(buildPlayerView(s).player.following).toMatchObject({ lost: 'down' });
  });
  it('a walk to someone without follow still ends at them (going over to talk)', () => {
    const s = quiet();
    place(s, 'patron_1', 'tav_common');
    play(s, { intent: intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1' } } }) });
    expect(s.player.walking).toBeUndefined();
    expect(buildPlayerView(s).player.following).toBeUndefined();
  });
});
