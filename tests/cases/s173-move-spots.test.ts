// 173 Spots inside a zone (BG-12) and no attacks on the dead (BG-13), from playtest run 36: "walk to the back of the
// cellar" had no move the Parser could give, and the Parser aimed at a slime its view listed as Dead.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { doorway, placeZones } from '../../src/scenario/geometry';
import { inferHeights } from '../../src/scenario/heights';
import { distM, placeAll, spotOf, spotPoint } from '../../src/engine/position';
import { checkParserLegality, illegalClarify } from '../../src/agents/legality';
import { checkIntent } from '../../src/agents/schema';
import { buildPlayerView } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { GameState, Intent } from '../../src/types';

function mapped(playerZone: string): GameState {
  const s = makeVillage({ playerZone });
  const zs = s.places.flatMap((p) => p.zones);
  for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, zs);
  placeAll(s);
  return s;
}
const zoneOf = (s: GameState, id: string) => s.places.flatMap((p) => p.zones).find((z) => z.id === id)!;
/** plays the move until it stops getting closer (a dash a turn) */
function walkTo(s: GameState, i: Intent): void {
  for (let n = 0; n < 4; n++) {
    const before = { ...s.player.pos! };
    play(s, { intent: i });
    if (Math.hypot(s.player.pos!.x - before.x, s.player.pos!.y - before.y) < 0.01) break;
  }
}

describe('173 move spots (BG-12)', () => {
  it('"the far end, away from the door" walks to the wall across from that doorway, a step inside it', () => {
    const s = mapped('tav_common');
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common');
    const room = zoneOf(s, 'tav_common'), door = doorway(room, zoneOf(s, 'street_door'))!;
    s.player.pos = { x: (room.rect!.x + door.x) / 2, y: (room.rect!.y + door.y) / 2 }; // between the middle and the door
    const start = distM(s, s.player, { zone: 'tav_common', pos: door });
    const goal = spotPoint(s, 'tav_common', { awayFrom: 'street_door' }, s.player)!;
    expect(goal.words).toBe('away from out the front door');
    walkTo(s, intent({ move: { toZone: 'tav_common', spot: { awayFrom: 'street_door' } } }));
    expect(s.player.zone).toBe('tav_common');
    expect(distM(s, s.player, { zone: 'tav_common', pos: goal.pos })).toBeLessThan(0.01);
    expect(distM(s, s.player, { zone: 'tav_common', pos: door })).toBeGreaterThan(start + 2);
    const r = room.rect!, p = s.player.pos!;
    expect(Math.min(r.w / 2 - Math.abs(p.x - r.x), r.d / 2 - Math.abs(p.y - r.y))).toBeCloseTo(CONFIG.ENTER_M, 1);
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
    const r = zoneOf(s, 'tav_cellar').rect!;
    expect(Math.min(r.w / 2 - Math.abs(there.x - r.x), r.d / 2 - Math.abs(there.y - r.y))).toBeCloseTo(CONFIG.ENTER_M, 1);
  });

  it('a compass side, and beside someone in the zone', () => {
    const s = mapped('tav_common');
    const room = zoneOf(s, 'tav_common').rect!;
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common' || a.id === 'patron_1');
    const wim = s.actors.find((a) => a.id === 'patron_1')!;
    wim.pos = { x: room.x, y: room.y - room.d / 2 + 0.5 };
    walkTo(s, intent({ move: { toZone: 'tav_common', spot: { side: 'north' } } }));
    expect(s.player.pos!.y).toBeCloseTo(room.y + room.d / 2 - CONFIG.ENTER_M, 1);
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
    const s = makeVillage({ playerZone: 'tav_cellar' });
    const zs = s.places.flatMap((p) => p.zones);
    inferHeights(s, zs);
    placeZones(s, zs);
    const cellar = zoneOf(s, 'tav_cellar');
    cellar.links.push({ to: 'cellar_tunnel', label: 'the low tunnel', sight: false });
    const tunnel = { id: 'cellar_tunnel', placeId: 'tavern', name: 'tunnel', look: 'a low tunnel', cover: 'none', light: 'dark', groundItems: [],
      links: [{ to: 'tav_cellar', label: 'back up into the cellar', sight: false }] } as GameState['places'][number]['zones'][number];
    s.places.find((p) => p.id === 'tavern')!.zones.push(tunnel);
    inferHeights(s, [tunnel]);
    placeZones(s, [tunnel]);
    expect(tunnel.height).toBe(cellar.height);
    const a = cellar.rect!, b = tunnel.rect!;
    const apart = Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.d + b.d) / 2);
    expect(apart).toBeGreaterThan(-0.01); // touching at most, never overlapping
    expect(doorway(cellar, tunnel)).not.toBeNull();
  });
  it('BG-81: a walk to a spot says "toward" while on the way and "at" once there', () => {
    const s = mapped('field_far');
    s.actors = s.actors.filter((a) => a.zone !== 'field_far' || a.id === 'player');
    const field = zoneOf(s, 'field_far'), r = field.rect!;
    s.player.pos = { x: r.x - r.w / 2 + 1.5, y: r.y };
    const i = intent({ move: { toZone: 'field_far', spot: { side: 'east' } } });
    const first = play(s, { intent: { ...i, action: { type: 'observe', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } as never } }).find((e) => e.kind === 'move' && e.actorId === 'player');
    expect(first?.spot).toBe('toward the east side'); // an open field: one slot does not cross it
    let last = first;
    for (let n = 0; n < 8 && last?.spot !== 'on the east side'; n++) last = play(s, { intent: i }).filter((e) => e.kind === 'move' && e.actorId === 'player').pop() ?? last;
    expect(last?.spot).toBe('on the east side');
  });
});
