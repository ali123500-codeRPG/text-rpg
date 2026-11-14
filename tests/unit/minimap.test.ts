// The play screen's minimap (AD8–AD16): the pure parts. A planned point's walk is the engine's own (walkRoute through the
// doorways), its turns count one move slot a turn after this turn's ring (carried time included, AD9), and a spot with no
// way the player knows is not plannable, saying why.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { carriedMoveS, metresText, planTo, ringMetres, splitAt, zoneAt, type MinimapPlan } from '../../src/ui/minimap';
import { knownMap } from '../../src/ui/mapData';
import { pathM, walkRoute } from '../../src/engine/position';
import { moveSpeed, slotMetres } from '../../src/engine/speed';
import { zoneById } from '../../src/engine/relations';
import { BK } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const village = (known: string[]) => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader', 'patron_1'] });
  s.player.journal = { ...s.player.journal!, zonesSeen: known };
  return s;
};
const centre = (s: GameState, id: string) => { const r = zoneById(s, id)!.rect!; return { x: r.x, y: r.y }; };
const ok = (p: MinimapPlan) => { if ('why' in p) throw new Error(p.why); return p; };

describe('minimap plans (AD16)', () => {
  it('outside a fight: no ring; a walk reads its metres and walking seconds, as the engine measures it', () => {
    const s = village(['tav_common', 'street_door', 'street_square']);
    expect(ringMetres(s)).toBeNull();
    const at = centre(s, 'street_square'), p = ok(planTo(s, knownMap(s), 'street_square', at));
    const r = walkRoute(s, s.player, { zone: 'street_square', pos: at }, s.player)!;
    expect(p.metres).toBeCloseTo(r.metres, 9);
    expect(p.metres).toBeCloseTo(pathM(s, s.player, { zone: 'street_square', pos: at }, ['street_door', 'street_square']), 9);
    expect(p.pts).toEqual(r.pts);
    expect(p.seconds).toBeCloseTo(p.metres / moveSpeed(s, s.player).walk, 9);
    expect(p.turns).toBe(1);
    expect(p.label).toBe(`the square, ${metresText(p.metres)}`);
    expect(p.words).toBe(`${metresText(p.metres)} · ${Math.round(p.seconds)} s walking`);
    expect({ x: p.x, y: p.y }).toEqual(at);
  });

  it('in a fight: the ring is one move slot this turn with the carried move time; past it the walk takes more turns', () => {
    const s = village(['tav_common', 'street_door', 'street_square', 'gate_inner']);
    s.mode = 'tactical';
    s.player.carry = [{ main: 1, move: 1.5, turn: s.turn - 1 }, { main: 0, move: 0.9, turn: s.turn }];
    expect(carriedMoveS(s)).toBeCloseTo(2.4, 9);
    const ring = ringMetres(s)!, per = slotMetres(s, s.player, 'move');
    expect(ring).toBeCloseTo(moveSpeed(s, s.player).walk * (CONFIG.FIGHT_TURN_S + 2.4), 9);
    const far = ok(planTo(s, knownMap(s), 'gate_inner', centre(s, 'gate_inner')));
    expect(far.metres).toBeGreaterThan(ring);
    expect(far.turns).toBe(1 + Math.ceil((far.metres - ring) / per));
    expect(far.words).toBe(`${metresText(far.metres)} · ${far.turns} turns · keeps walking by itself`);
    const r = zoneById(s, 'tav_common')!.rect!, me = s.player.pos!;
    const near = ok(planTo(s, knownMap(s), 'tav_common', { x: me.x + Math.sign(r.x - me.x || 1) * 1.5, y: me.y }));
    expect(near.turns).toBe(1);
    expect(near.words).toMatch(/ · \d+ s walking · this turn$/);
  });

  it('a point past the walls is planned a step inside them (spotPoint), as the walk will stop', () => {
    const s = village(['tav_common']), r = zoneById(s, 'tav_common')!.rect!;
    const p = ok(planTo(s, knownMap(s), 'tav_common', { x: r.x + r.w, y: r.y }));
    expect(p.x).toBeCloseTo(r.x + r.w / 2 - CONFIG.ENTER_M, 9);
  });

  it('no plan without a way the player knows, and it says why', () => {
    const s = village(['tav_common', 'street_square']);
    const m = knownMap(s);
    expect(planTo(s, m, 'gate_inner', centre(s, 'gate_inner'))).toEqual({ why: 'You don’t know what is there.' });
    expect(planTo(s, m, 'street_square', centre(s, 'street_square'))).toEqual({ why: 'You know no way there.' }); // through the street door, unknown
    expect(planTo(s, m, 'tav_common', { ...s.player.pos! })).toEqual({ why: 'You are standing there.' });
    // a way the player tried and found locked, with no other way round
    s.barriers = { door: { id: 'door', kind: BK.door, grade: 'minor', lock: { locked: true }, tried: ['player'] } };
    for (const [a, b] of [['tav_common', 'street_door'], ['street_door', 'tav_common']]) zoneById(s, a)!.links.find((l) => l.to === b)!.barrier = 'door';
    s.player.journal!.zonesSeen = ['tav_common', 'street_door'];
    expect((planTo(s, knownMap(s), 'street_door', centre(s, 'street_door')) as { why: string }).why).toMatch(/^No way there you can take: out the front door \(.*locked\)\.$/);
  });

  it('splitAt cuts a path where this turn’s metres run out; metres read to a tenth under 10 m', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    expect(splitAt(pts, 5)).toEqual([[{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }], [{ x: 3, y: 2 }, { x: 3, y: 4 }]]);
    expect(splitAt(pts, 7)).toEqual([pts, []]);
    expect(metresText(6.44)).toBe('6.4 m');
    expect(metresText(22.3)).toBe('22 m');
  });

  it('zoneAt picks the smallest known zone holding the point', () => {
    const z = (id: string, w: number) => ({ id, rect: { x: 0, y: 0, w, d: w } }) as Parameters<typeof zoneAt>[0][number];
    expect(zoneAt([z('big', 20), z('small', 4)], { x: 1, y: 1 })?.id).toBe('small');
    expect(zoneAt([z('big', 20), z('small', 4)], { x: 5, y: 5 })?.id).toBe('big');
    expect(zoneAt([z('big', 20)], { x: 50, y: 0 })).toBeUndefined();
  });
});
