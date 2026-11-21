// 423 D-200 (D-200b b): attention. What lies past ATTENTION_SIDE_DEG off the way someone faces is seen one rung worse
// (clear becomes a glimpse), past ATTENTION_BACK_DEG two rungs worse (a glimpse two grades harder to make out), never
// nothing; someone busy (a long action, or fighting someone else) sees one rung worse. Without a facing it sees all round.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { faintness, sightAt } from '../../src/perception';
import { attentionSteps, offFacingDeg } from '../../src/perception/attention';
import { CONFIG } from '../../src/config';

const Y = -13.872983346207416; // field_mid spans x 90..130
/** the player at x 100 facing east (+x), the guard 5 m away at `deg` off that facing */
function setUp(deg: number | null) {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'patron_1', 'trader'] });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_mid'; g.placeId = s.player.placeId; g.floor = s.player.floor;
  s.player.pos = { x: 100, y: Y };
  const r = ((deg ?? 0) * Math.PI) / 180;
  g.pos = { x: 100 + 5 * Math.cos(r), y: Y + 5 * Math.sin(r) };
  if (deg === null) delete s.player.facing; else s.player.facing = [1, 0];
  return { s, g };
}
const ev = (s: GameState, g: Actor, visibility: GameEvent['visibility'] = 'normal'): GameEvent =>
  ({ id: 'e1', turn: s.turn, actorId: g.id, kind: 'idle', zone: g.zone, pos: g.pos ? { x: g.pos.x, y: g.pos.y, floor: g.floor ?? 0 } : undefined, effects: [], noise: 'quiet', visibility, perception: {} }) as GameEvent;

describe('423 attention', () => {
  it('measures the angle off the facing', () => {
    expect(offFacingDeg({ pos: { x: 0, y: 0 }, facing: [1, 0] }, { x: 1, y: 1 })).toBeCloseTo(45);
    expect(offFacingDeg({ pos: { x: 0, y: 0 }, facing: [1, 0] }, { x: -1, y: 0 })).toBeCloseTo(180);
    expect(offFacingDeg({ pos: { x: 0, y: 0 } }, { x: 1, y: 0 })).toBeNull();
  });

  it('ahead is clear; to the side a glimpse at the easiest grade; behind a glimpse two grades harder; no facing sees all round', () => {
    expect(CONFIG.SIGHT_M.normal![0]).toBeGreaterThan(5); // 5 m is within clear sight
    const ahead = setUp(30), side = setUp(CONFIG.ATTENTION_SIDE_DEG + 20), back = setUp(CONFIG.ATTENTION_BACK_DEG + 40), none = setUp(null);
    expect(attentionSteps(ahead.s, ahead.s.player, ahead.g)).toBe(0);
    expect(sightAt(ahead.s, ahead.s.player, ahead.g, 'normal')).toBe('full');
    expect(attentionSteps(side.s, side.s.player, side.g)).toBe(CONFIG.ATTENTION_SIDE_STEPS);
    expect(sightAt(side.s, side.s.player, side.g, 'normal')).toBe('partial');
    expect(faintness(side.s, ev(side.s, side.g), side.s.player, 'sight')).toBe('minor');
    expect(attentionSteps(back.s, back.s.player, back.g)).toBe(CONFIG.ATTENTION_BACK_STEPS);
    expect(sightAt(back.s, back.s.player, back.g, 'normal')).toBe('partial');
    expect(faintness(back.s, ev(back.s, back.g), back.s.player, 'sight')).toBe('moderate'); // clear, two rungs: a glimpse one grade past the easiest
    expect(sightAt(none.s, none.s.player, none.g, 'normal')).toBe('full');
  });

  it('a glimpse behind is two grades harder, and attention never takes sight away', () => {
    const { s, g } = setUp(180);
    const band = CONFIG.SIGHT_M.close!; // a close-visibility act: glimpsed from its clear metres out to its glimpse metres
    s.player.pos = { x: 120, y: Y };
    g.pos = { x: 120 - (band[0] + 0.1 * (band[1] - band[0])), y: Y }; // just past clear range: Minor when faced
    expect(faintness(s, ev(s, g, 'close'), s.player, 'sight')).toBe('major');
    g.pos = { x: 120 - (band[0] + 0.9 * (band[1] - band[0])), y: Y }; // Extreme when faced
    expect(sightAt(s, s.player, g, 'close')).toBe('partial');
    expect(faintness(s, ev(s, g, 'close'), s.player, 'sight')).toBe('extreme');
  });

  it('busy: a long action under way, or fighting someone else, sees one rung worse; the foe it fights is not "someone else"', () => {
    const { s, g } = setUp(0);
    s.player.busy = { row: 'search', key: 'k', order: { type: 'search', target: null, item: null }, done: 0, need: 60, turn: s.turn };
    expect(attentionSteps(s, s.player, g)).toBe(CONFIG.ATTENTION_BUSY_STEPS);
    expect(sightAt(s, s.player, g, 'normal')).toBe('partial');
    s.player.busy.paused = true;
    expect(attentionSteps(s, s.player, g)).toBe(0);
    s.events.push({ ...ev(s, s.player), id: 'a1', actorId: s.player.id, kind: 'attack', target: 'someone_else' });
    expect(attentionSteps(s, s.player, g)).toBe(CONFIG.ATTENTION_BUSY_STEPS);
    s.events.push({ ...ev(s, s.player), id: 'a2', actorId: s.player.id, kind: 'attack', target: g.id });
    expect(attentionSteps(s, s.player, g)).toBe(0);
  });
});
