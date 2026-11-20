// The play screen's minimap (AD8–AD16): the pure parts. A planned point's walk is the engine's own (walkRoute through the
// doorways), its turns count one move slot a turn after this turn's ring (carried time included, AD9), and a spot with no
// way the player knows is not plannable, saying why.
import { describe, expect, it } from 'vitest';
import { makeVillage, setBarrier } from '../harness';
import { planTo } from '../../src/ui/minimap';
import { knownMap } from '../../src/ui/mapData';
import { zoneById } from '../../src/engine/relations';
import { BK } from '../../src/library/tableIds';
import type { GameState } from '../../src/types';
import { boxOf } from '../../src/plan/geom';

const village = (known: string[]) => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader', 'patron_1'] });
  s.player.journal = { ...s.player.journal!, zonesSeen: known };
  return s;
};
const centre = (s: GameState, id: string) => { const r = boxOf(zoneById(s, id)!.outline); return { x: r.x, y: r.y }; };

describe('minimap plans (AD16)', () => {

  it('no plan without a way the player knows, and it says why', () => {
    const s = village(['tav_common', 'street_square']);
    const m = knownMap(s);
    expect(planTo(s, m, 'gate_inner', centre(s, 'gate_inner'))).toEqual({ why: 'You don’t know what is there.' });
    expect(planTo(s, m, 'street_square', centre(s, 'street_square'))).toEqual({ why: 'You know no way there.' }); // through the street door, unknown
    expect(planTo(s, m, 'tav_common', { ...s.player.pos! })).toEqual({ why: 'You are standing there.' });
    // a way the player tried and found locked, with no other way round
    s.barriers = { door: { id: 'door', kind: BK.door, grade: 'minor', lock: { locked: true }, tried: ['player'] } };
    setBarrier(s, 'tav_common', 'street_door', 'door');
    s.player.journal!.zonesSeen = ['tav_common', 'street_door'];
    expect((planTo(s, knownMap(s), 'street_door', centre(s, 'street_door')) as { why: string }).why).toMatch(/^No way there you can take: out the front door \(.*locked\)\.$/);
  });

});
