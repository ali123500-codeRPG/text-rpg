// 325 A move to an exact point (AD16): the minimap plans a move to a point in metres (MoveSpot.at); code sets it, never
// the Parser. The walk goes there by the usual route through the doorways, a point past the walls stops a step inside
// them, and a point further than a fight turn's walk carries on by itself.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { distM, spotPoint, walkRoute } from '../../src/engine/position';
import { checkParserLegality } from '../../src/agents/legality';
import { checkIntent } from '../../src/agents/schema';
import { buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { GameState, Intent } from '../../src/types';

const quiet = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1', 'trader'] });
const rect = (s: GameState, id: string) => s.zones.find((z) => z.id === id)!.rect!;
const to = (toZone: string, x: number, y: number): Intent => intent({ move: { toZone, spot: { at: { x, y } } } });
/** plays the move until it stops getting closer */
function walkTo(s: GameState, i: Intent, fight = false): number {
  let n = 0;
  for (; n < 8; n++) {
    const before = { zone: s.player.zone, ...s.player.pos! };
    if (fight) s.mode = 'tactical';
    play(s, { intent: n === 0 ? i : intent() }); // AT49: after the first turn the walk carries on by itself
    if (s.player.zone === before.zone && Math.hypot(s.player.pos!.x - before.x, s.player.pos!.y - before.y) < 0.01) break;
  }
  return n;
}

describe('325 a move to an exact point (AD16)', () => {
  it('walks to the point in the same zone, within a step', () => {
    const s = quiet(), r = rect(s, 'tav_common');
    const at = { x: r.x + r.w / 4, y: r.y - r.d / 4 };
    walkTo(s, to('tav_common', at.x, at.y));
    expect(s.player.zone).toBe('tav_common');
    expect(distM(s, s.player, { zone: 'tav_common', pos: at })).toBeLessThanOrEqual(CONFIG.ENTER_M);
  });

  it('walks through the doorway to the point in a linked zone; the story says "to a spot in" it', () => {
    const s = quiet(), r = rect(s, 'street_door');
    const at = { x: r.x + r.w / 5, y: r.y };
    const ev = play(s, { intent: to('street_door', at.x, at.y) });
    walkTo(s, intent());
    expect(s.player.zone).toBe('street_door');
    expect(distM(s, s.player, { zone: 'street_door', pos: at })).toBeLessThanOrEqual(CONFIG.ENTER_M);
    expect(ev.some((e) => e.kind === 'move' && e.actorId === 'player')).toBe(true);
    expect(spotPoint(s, 'street_door', { at }, s.player)?.words).toBe('to a spot in outside the tavern');
  });

  it('a point outside the zone is clamped a step inside its walls', () => {
    const s = quiet(), r = rect(s, 'tav_common');
    const far = { x: r.x + r.w * 3, y: r.y + r.d * 3 };
    const sp = spotPoint(s, 'tav_common', { at: far }, s.player)!;
    expect(sp.pos.x).toBeCloseTo(r.x + r.w / 2 - CONFIG.ENTER_M, 6);
    expect(sp.pos.y).toBeCloseTo(r.y + r.d / 2 - CONFIG.ENTER_M, 6);
    walkTo(s, to('tav_common', far.x, far.y));
    expect(s.player.zone).toBe('tav_common');
    expect(distM(s, s.player, { zone: 'tav_common', pos: sp.pos })).toBeLessThan(0.01);
  });

  it('in a fight a far point takes several turns: the walk carries on and gets there', () => {
    const s = quiet(), r = rect(s, 'street_square');
    const at = { x: r.x, y: r.y };
    const route = walkRoute(s, s.player, { zone: 'street_square', pos: at }, s.player)!;
    s.mode = 'tactical';
    play(s, { intent: to('street_square', at.x, at.y) });
    expect(s.player.walking?.spot?.at).toEqual(at);
    const turns = 1 + walkTo(s, intent(), true);
    expect(route.metres).toBeGreaterThan(CONFIG.FIGHT_TURN_S * 2);
    expect(turns).toBeGreaterThan(1);
    expect(s.player.zone).toBe('street_square');
    expect(distM(s, s.player, { zone: 'street_square', pos: at })).toBeLessThanOrEqual(CONFIG.ENTER_M);
    expect(s.player.walking).toBeUndefined();
  });

  it('walkRoute measures what the walk walks: from you through the doorways to the point', () => {
    const s = quiet(), r = rect(s, 'street_door');
    const goal = { zone: 'street_door', pos: { x: r.x, y: r.y } };
    const w = walkRoute(s, s.player, goal, s.player)!;
    expect(w.path).toEqual(['street_door']);
    expect(w.pts[0]).toEqual(s.player.pos);
    expect(w.pts.at(-1)).toEqual(goal.pos);
    const len = w.pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - w.pts[i].x, p.y - w.pts[i].y), 0);
    expect(len).toBeCloseTo(w.metres, 6);
    expect(w.metres).toBeGreaterThanOrEqual(distM(s, s.player, goal) - 1e-9);
  });

  it('legality keeps a point in a zone the player knows, with finite metres; the Parser can never give one', () => {
    const s = quiet(), v = buildPlayerView(s);
    expect(checkParserLegality(to('tav_common', 1, 1), v).intent.move?.spot).toEqual({ at: { x: 1, y: 1 } });
    expect(checkParserLegality(to('street_door', 1, 1), v).illegal).toEqual([]);
    expect(checkParserLegality(to('tav_common', NaN, 1), v).illegal[0]).toMatch(/^move\.spot/);
    expect(checkParserLegality(intent({ move: { toZone: 'tav_common', spot: { at: { x: 1, y: 1 }, side: 'north' } } }), v).illegal[0]).toMatch(/^move\.spot/);
    expect(checkParserLegality(to('nowhere', 1, 1), v).illegal).toContain('move.toZone nowhere');
    const parsed = checkIntent({ move: { toZone: 'tav_common', spot: { at: { x: 1, y: 1 } } }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null });
    expect(parsed.value.move?.spot?.at).toBeUndefined();
  });
});
