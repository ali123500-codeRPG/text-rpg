// BG-190 on the play screen: while you follow someone the action box says whom, where they are now and how far, with
// Keep following and Stop here; the turn you lose them it says what happened and where, once, with Look for them.
import { describe, expect, it } from 'vitest';
import { followingChips, followingText } from '../../src/ui/doing';
import { buildPlayerView } from '../../src/views';
import { wholeTurn, intent } from '../harness/turn';
import { place } from '../harness';
import type { GameState } from '../../src/types';

const follow = (s: GameState) => intent({ move: { toZone: s.actors.find((a) => a.id === 'patron_1')!.zone, spot: { near: 'patron_1', follow: true } } });
const setup = () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const s = g.game.state()!;
  place(s, 'patron_1', 'tav_common');
  return { g, s };
};

describe('BG-190 the following line', () => {
  it('whole turn: following someone reads "Following <name>" with Keep following and Stop here', async () => {
    const { g, s } = setup();
    await g.turn(follow(s), 'I follow the patron');
    const p = buildPlayerView(s).player;
    expect(p.following).toMatchObject({ who: 'patron_1' });
    expect(followingText(p.following!, p.walking)).toMatch(new RegExp(`^Following ${p.following!.name} · `));
    expect(followingChips(p.following!).map((c) => c.text)).toEqual([`I keep following ${p.following!.name}`, 'I stop and wait here']);
  });

  it('whole turn: lost from sight, the line says why and where, then is gone the turn after', async () => {
    const { g, s } = setup();
    await g.turn(follow(s), 'I follow the patron');
    place(s, 'patron_1', 'field_far'); // gone, out of sight and earshot
    await g.turn(intent({ action: null }), 'I keep following');
    const f = buildPlayerView(s).player.following!;
    expect(f.lost).toBe('out_of_sight');
    expect(followingText(f)).toBe(`Lost ${f.name} · they went on out of sight from ${f.zone}`);
    expect(followingChips(f).map((c) => c.key)).toEqual(['look-for']);
    await g.turn(intent(), 'I look around');
    expect(buildPlayerView(s).player.following).toBeUndefined();
  });

  it('every way of losing someone has its words', () => {
    const f = { who: 'x', name: 'Bren', zone: 'the yard' };
    expect(followingText({ ...f, lost: 'down' })).toBe('Lost Bren · they went down in the yard');
    expect(followingText({ ...f, lost: 'slipped_away' })).toBe('Lost Bren · they slipped out of sight in the yard');
    expect(followingText({ who: 'x', name: 'Bren' })).toBe('Following Bren · close behind');
  });
});
