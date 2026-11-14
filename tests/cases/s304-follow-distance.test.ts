// BF35: on turn 21 following Wren walked Happi onto the very spot where he stood (0 m). A walk never ends on someone now (a
// step of room), a follow keeps the distance the player says (metres, bow range at 80% of the bow's reach, or close; not
// said: 5 m sneaking, 2 m otherwise), closes in when he gets farther and never backs off, and an NPC following the player
// keeps striking reach, or stays inside its ranged weapon's reach.
import { describe, expect, it } from 'vitest';
import { actor, makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { distM } from '../../src/engine/position';
import { buildPlayerView } from '../../src/views';
import { followingText } from '../../src/ui/doing';
import { usableModes } from '../../src/ruleset/gear';
import { switchRoutine } from '../../src/minds/state';
import { FOLLOW_ROUTINE } from '../../src/minds';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import type { Actor, GameState } from '../../src/types';

const field = () => {
  const s = makeVillage({ playerZone: 'field_mid', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.zones.find((z) => z.id === 'field_mid')!.rect = { x: 0, y: 0, w: 200, d: 20 };
  s.player.pos = { x: -90, y: 0 };
  const w = place(s, 'patron_1', 'field_mid');
  w.pos = { x: 10, y: 0 };
  return { s, w };
};
const bow = (a: Actor) => {
  for (const i of a.core.inventory) if (i.equippedIn?.some((e) => e.startsWith('grip:'))) i.equippedIn = [];
  a.core.inventory.push({ id: `bow_${a.id}`, itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
};
const rangeOf = (s: GameState, a: Actor) => Math.max(...usableModes(s, a).filter((m) => m.mode.tree === 'ranged').map((m) => m.mode.reach)) * CONFIG.FOLLOW_RANGE_SHARE;
const follow = (keep?: number | 'range' | 'melee') => intent({ move: { toZone: 'field_mid', spot: { near: 'patron_1', follow: true, ...(keep !== undefined ? { keep } : {}) } } });
const gap = (s: GameState, a: Actor, b: Actor) => distM(s, a, { zone: b.zone, pos: b.pos! });

describe('BF35 following at a distance', () => {
  it('at bow range the player keeps 80% of the bow\'s reach, closes in when he walks off, and never backs off', () => {
    const { s, w } = field();
    bow(s.player);
    const keep = rangeOf(s, s.player);
    for (let i = 0; i < 6 && gap(s, s.player, w) > keep + 0.5; i++) play(s, { intent: i ? intent() : follow('range') });
    expect(gap(s, s.player, w)).toBeCloseTo(keep, 0);
    expect(followingText(buildPlayerView(s).player.following!)).toContain(`${Math.round(keep * 10) / 10} m back`);
    w.pos = { x: w.pos!.x + 20, y: 0 }; // he walks off
    play(s, { intent: intent() });
    expect(gap(s, s.player, w)).toBeCloseTo(keep, 0);
    const at = { ...s.player.pos! };
    w.pos = { x: s.player.pos!.x + 5, y: 0 }; // he turns and comes near
    play(s, { intent: intent() });
    expect(s.player.pos).toEqual(at);
  });
  it('not said, a follow keeps 2 m, or 5 m sneaking; said in metres, that', () => {
    const a = field();
    a.w.pos = { x: -80, y: 0 };
    play(a.s, { intent: follow() });
    expect(gap(a.s, a.s.player, a.w)).toBeCloseTo(CONFIG.FOLLOW_M, 1);
    const b = field();
    b.w.pos = { x: -80, y: 0 };
    b.s.player.posture = 'stealthy';
    play(b.s, { intent: follow() });
    expect(gap(b.s, b.s.player, b.w)).toBeCloseTo(CONFIG.FOLLOW_SNEAK_M, 1);
    const c = field();
    c.w.pos = { x: -60, y: 0 };
    play(c.s, { intent: follow(20) });
    expect(gap(c.s, c.s.player, c.w)).toBeCloseTo(20, 1);
  });
  it('a walk never ends on someone: it stops a step short of anyone at its end', () => {
    const { s, w } = field();
    const o = place(s, 'trader', 'field_mid');
    o.pos = { x: -80, y: 0 };
    w.pos = { x: -70, y: 0 };
    play(s, { intent: intent({ move: { toZone: 'field_mid', spot: { near: 'patron_1' } } }) });
    expect(gap(s, s.player, w)).toBeCloseTo(CONFIG.PLACE_GAP_M, 1);
    expect(gap(s, s.player, o)).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
  });
  it('an NPC following the player with a bow stays inside its reach; with none it closes to striking reach', () => {
    const { s, w } = field();
    w.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(switchRoutine(s, w, FOLLOW_ROUTINE, 'agent')).toBe(true);
    bow(w);
    const keep = rangeOf(s, w);
    for (let i = 0; i < 12; i++) play(s);
    expect(gap(s, w, s.player)).toBeLessThanOrEqual(keep + 0.5);
    expect(gap(s, w, s.player)).toBeGreaterThan(keep - 1);
    for (const i of w.core.inventory) i.equippedIn = [];
    for (let i = 0; i < 12; i++) play(s);
    expect(gap(s, w, s.player)).toBeLessThan(3);
  });
});
