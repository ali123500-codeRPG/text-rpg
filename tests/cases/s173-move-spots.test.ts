// 173 Spots inside a zone (BG-12) and no attacks on the dead (BG-13), from playtest run 36: "walk to the back of the
// cellar" had no move the Parser could give, and the Parser aimed at a slime its view listed as Dead.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { withWays } from '../harness/village';
import { wayTo } from '../../src/plan/where';
import { boxOf, sharedSides } from '../../src/plan/geom';
import { distM, placeAll, spotOf, spotPoint } from '../../src/engine/position';
import { checkParserLegality, illegalClarify } from '../../src/agents/legality';
import { checkIntent } from '../../src/agents/schema';
import { buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { GameState, Intent } from '../../src/types';

const mapped = (playerZone: string): GameState => makeVillage({ playerZone });
const zoneOf = (s: GameState, id: string) => s.places.flatMap((p) => p.zones).find((z) => z.id === id)!;
const rectOf = (s: GameState, id: string) => boxOf(zoneOf(s, id).outline);
/** plays the move until it stops getting closer (a dash a turn) */
function walkTo(s: GameState, i: Intent): void {
  for (let n = 0; n < 4; n++) {
    const before = { ...s.player.pos! };
    play(s, { intent: i });
    if (Math.hypot(s.player.pos!.x - before.x, s.player.pos!.y - before.y) < 0.01) break;
  }
}

/** SZ19: a person's middle stands a step (ENTER_M) from a wall to its body's edge: half its widest side (0.5 m) more */
const WALL_M = CONFIG.ENTER_M + 0.25;
describe('173 move spots (BG-12)', () => {
  it('"the far end, away from the door" walks to the wall across from that doorway, a step inside it', () => {
    const s = mapped('tav_common');
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common');
    const room = rectOf(s, 'tav_common'), door = wayTo(s, 'tav_common', 'street_door')!.opening.at;
    s.player.pos = { x: (room.x + door.x) / 2, y: (room.y + door.y) / 2 }; // between the middle and the door
    const start = distM(s, s.player, { zone: 'tav_common', pos: door });
    const goal = spotPoint(s, 'tav_common', { awayFrom: 'street_door' }, s.player)!;
    expect(goal.words).toBe('away from out the front door');
    walkTo(s, intent({ move: { toZone: 'tav_common', spot: { awayFrom: 'street_door' } } }));
    expect(s.player.zone).toBe('tav_common');
    expect(distM(s, s.player, { zone: 'tav_common', pos: goal.pos })).toBeLessThan(0.01);
    expect(distM(s, s.player, { zone: 'tav_common', pos: door })).toBeGreaterThan(start + 2);
    const r = room, p = s.player.pos!;
    expect(Math.min(r.w / 2 - Math.abs(p.x - r.x), r.d / 2 - Math.abs(p.y - r.y))).toBeCloseTo(WALL_M, 1);
  });

  it('away from stairs in the middle of the cellar: to a wall, and it stays there (run 36\'s cellar)', () => {
    const s = mapped('tav_counter');
    s.actors = s.actors.filter((a) => a.zone !== 'tav_cellar');
    play(s, { intent: intent({ move: { toZone: 'tav_cellar' } }) });
    expect(s.player.zone).toBe('tav_cellar');
    const i = intent({ move: { toZone: 'tav_cellar', spot: { awayFrom: 'tav_counter' } } });
    const ev = play(s, { intent: i });
    expect(ev.find((e) => e.kind === 'move' && e.actorId === 'player')?.spot).toBe('away from up the cellar steps');
    const there = { ...s.player.pos! };
    play(s, { intent: i });
    expect(distM(s, s.player, { zone: 'tav_cellar', pos: there })).toBeLessThan(0.01);
    const r = rectOf(s, 'tav_cellar');
    expect(Math.min(r.w / 2 - Math.abs(there.x - r.x), r.d / 2 - Math.abs(there.y - r.y))).toBeCloseTo(WALL_M, 1);
  });

  it('a compass side, and beside someone in the zone', () => {
    const s = mapped('tav_common');
    const room = rectOf(s, 'tav_common');
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common' || a.id === 'patron_1');
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    wim.pos = { x: room.x, y: room.y - room.d / 2 + 0.5 };
    walkTo(s, intent({ move: { toZone: 'tav_common', spot: { side: 'north' } } }));
    expect(s.player.pos!.y).toBeCloseTo(room.y + room.d / 2 - WALL_M, 1);
    expect(s.player.pos!.x).toBeCloseTo(room.x, 1);
    const ev: string[] = [];
    for (let n = 0; n < 3; n++) ev.push(...play(s, { intent: intent({ move: { toZone: 'tav_common', spot: { near: 'patron_1' } } }) }).filter((e) => e.kind === 'move').map((e) => e.target ?? ''));
    expect(distM(s, s.player, wim)).toBeLessThan(CONFIG.PLACE_SPACING_M + 0.01);
    expect(ev).toContain('patron_1');
  });

  it('the Parser may give a spot; legality keeps a move in the own zone only with one', () => {
    const s = mapped('tav_cellar');
    const view = buildPlayerView(s);
    const parsed = checkIntent({ move: { toZone: 'tav_cellar', spot: { awayFrom: 'tav_counter' } }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null });
    expect(parsed.errors).toEqual([]);
    expect(checkParserLegality(parsed.value, view).intent.move?.spot).toEqual({ awayFrom: 'tav_counter' });
    expect(checkParserLegality(intent({ move: { toZone: 'tav_cellar' } }), view).intent.move).toBeNull();
    const bad = checkParserLegality(intent({ move: { toZone: 'tav_cellar', spot: { side: 'upward' } } }), view);
    expect(bad.illegal[0]).toMatch(/^move\.spot/);
    expect(illegalClarify(bad.illegal, view)).toMatch(/^Where in cellar/);
    expect(checkParserLegality(intent({ move: { toZone: 'tav_cellar', spot: { near: 'nobody' } } }), view).illegal[0]).toMatch(/^move\.spot/);
  });
});

describe('173 no attacks on the dead (BG-13)', () => {
  it('an attack on someone the view lists as Dead stops with a question naming only the living', () => {
    const s = mapped('tav_common'); // lit: in the dark cellar the player only half sees them, and health doesn't show
    const big = place(s, 'slime_1', 'tav_common');
    place(s, 'slime_2', 'tav_common');
    placeAll(s);
    big.core.condition.hpLostPct = 1000;
    const view = buildPlayerView(s);
    expect(view.actors.find((a) => a.id === 'slime_1')?.health).toBe('dead');
    const out = checkParserLegality(intent({ action: { type: 'attack', target: 'slime_1' } }), view);
    expect(out.illegal).toEqual(['action.target_dead slime_1']);
    const q = illegalClarify(out.illegal, view)!;
    expect(q).toMatch(/^That one is already dead\./);
    expect(checkParserLegality(intent({ action: { type: 'attack', target: 'slime_2' } }), view).illegal).toEqual([]);
  });
});

describe('173 a level tunnel off the cellar is laid beside it (run 36)', () => {
  it('"the low tunnel" one way and "back up into the cellar" the other: same height, so side by side, not on top', () => {
    const tunnel = { id: 'cellar_tunnel', placeId: 'tavern', name: 'tunnel', look: 'a low tunnel', light: 'dark' as const, roof: true,
      ways: [{ to: 'tav_cellar', label: 'back up into the cellar', kind: 'door' as const }] };
    const s = makeVillage({ playerZone: 'tav_cellar', shape: { tav_cellar: withWays('tav_cellar', { to: 'cellar_tunnel', label: 'the low tunnel', kind: 'door' }) }, add: [tunnel] });
    const cellar = zoneOf(s, 'tav_cellar'), t = zoneOf(s, 'cellar_tunnel');
    expect(t.floor).toBe(cellar.floor);
    const a = boxOf(cellar.outline), b = boxOf(t.outline);
    const apart = Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.d + b.d) / 2);
    expect(apart).toBeGreaterThan(-0.01); // touching at most, never overlapping
    expect(sharedSides(cellar.outline, t.outline).length).toBeGreaterThan(0);
    expect(wayTo(s, 'tav_cellar', 'cellar_tunnel')?.opening.wall).toBeDefined();
  });
});
