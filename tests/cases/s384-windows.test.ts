// PC3: windows. A window is a drop (seen, shot and jumped through, never walked) with shutters, a barrier kind that opens,
// shuts, locks and bars like a door. Through any opening a target shows only the band of its height the opening frames,
// carried along the sight line, and no more of its width than the opening's.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage, place, createRng } from '../harness';
import { zoneById } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';
import { BK } from '../../src/library/tableIds';
import { coverMod, coverShown } from '../../src/ruleset/gear';
import { openingShown } from '../../src/ruleset/objectCover';
import { resolveTurn } from '../../src/engine';
import { seesAcross } from '../../src/engine/relations';
import { wayOp } from '../../src/engine/barriers';

/** the common room (6 × 6 m) with a window in its south wall onto the street; the guard 2 m inside, the player out in
 * the street 13 m from the window */
function house(open = true, kind: string = BK.window): GameState {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  const inside = zoneById(s, 'tav_common')!, out = zoneById(s, 'street_door')!;
  inside.rect = { x: 0, y: 0, w: 6, d: 6 }; out.rect = { x: 0, y: -10.5, w: 10, d: 15 };
  inside.height = 0; out.height = 0;
  s.barriers = { ...(s.barriers ?? {}), win1: { id: 'win1', kind, grade: 'minor', ...(open ? { open: true as const } : {}) } };
  inside.links = inside.links.filter((l) => l.to !== 'street_door').concat({ to: 'street_door', label: 'the window, south', kind: 'window', barrier: 'win1' });
  out.links = out.links.filter((l) => l.to !== 'tav_common').concat({ to: 'tav_common', label: 'the window', kind: 'window', barrier: 'win1' });
  const g = place(s, 'guard_1', 'tav_common'); g.pos = { x: 0, y: -1 };
  place(s, 'player', 'street_door'); s.player.pos = { x: 0, y: -16 };
  return s;
}

describe('384 windows (PC3)', () => {
  it('a Window is shutters 0.6 × 1 m with the sill 0.9 m up, that lock and bar', () => {
    const k = getLibrary().barrierKinds![BK.window];
    expect(k).toMatchObject({ window: true, sillM: 0.9, openingM: [0.6, 1], lock: true, bar: true, seeThrough: false });
  });

  it('through the open window a person 2 m inside shows about 55% (head and chest): −9, the hub example', () => {
    const s = house();
    const g = s.actors.find((a) => a.id === 'guard_1')!, z = zoneById(s, 'tav_common')!;
    expect(openingShown(s, g, z, s.player)).toBeCloseTo(0.55, 2);
    expect(coverMod(coverShown(s, g, z, s.player))).toBe(9);
    expect(openingShown(s, g, z, g)).toBe(1); // seen from inside the same room: no frame
  });

  it('shut shutters hide everything: no sight through, so no frame and no shot', () => {
    const s = house(false);
    const g = s.actors.find((a) => a.id === 'guard_1')!, z = zoneById(s, 'tav_common')!;
    expect(openingShown(s, g, z, s.player)).toBe(1); // nothing is seen through it at all
  });

  it('a jump through a window needs its shutters open', () => {
    const shut = house(false);
    zoneById(shut, 'tav_common')!.links.find((l) => l.to === 'street_door')!.sight = false;
    place(shut, 'player', 'tav_common'); shut.player.pos = { x: 0, y: -2 };
    shut.turn += 1;
    resolveTurn(shut, { intent: { move: { toZone: 'street_door', jump: true }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null }, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    expect(shut.player.zone).toBe('tav_common');
    const open = house(true);
    place(open, 'player', 'tav_common'); open.player.pos = { x: 0, y: -2 };
    open.turn += 1;
    resolveTurn(open, { intent: { move: { toZone: 'street_door', jump: true }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null }, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
    expect(open.player.zone).toBe('street_door');
  });
});

describe('384 windows: the frame works one way', () => {
  it('a target far out seen from just inside the window is not framed: the opening widens with distance', () => {
    const s = house();
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    // the guard looks out from right at the window; the player is 13 m out in the street
    g.pos = { x: 0, y: -2.6 };
    expect(openingShown(s, s.player, zoneById(s, 'street_door')!, g)).toBe(1);
  });
});

describe('384 window kinds (PC4)', () => {
  it('four kinds, by real size; a slit and bars are always seen through and never open or shut', () => {
    const k = getLibrary().barrierKinds!;
    expect([BK.window, BK.arrow_slit, BK.barred_window, BK.large_window].map((id) => [k[id].name, k[id].openingM, k[id].sillM, !!k[id].fixed])).toEqual([
      ['Shuttered window', [0.6, 1], 0.9, false], ['Arrow slit', [0.1, 1.2], 1, true], ['Barred window', [0.6, 1], 0.9, true], ['Large window', [1.2, 1.5], 0.6, false]]);
    const s = house(false, BK.arrow_slit);
    expect(seesAcross(s, zoneById(s, 'street_door')!.links.find((l) => l.to === 'tav_common')!)).toBe(true);
    expect(wayOp(s.barriers!.win1, s.player, 'street_door', 'open')).toBe('fixed');
  });

  it('a person 2 m behind each, shot from 15 m: the hub examples', () => {
    const at = (kind: string, open: boolean) => {
      const s = house(open, kind);
      const g = s.actors.find((a) => a.id === 'guard_1')!, z = zoneById(s, 'tav_common')!;
      return coverMod(coverShown(s, g, z, s.player));
    };
    expect(at(BK.window, true)).toBe(9);
    expect(at(BK.arrow_slit, false)).toBe(32);
    expect(at(BK.barred_window, false)).toBe(9);
    expect(at(BK.large_window, true)).toBe(4);
  });

  it('nobody jumps through bars or a slit; a large window open is jumped through', () => {
    const tryJump = (kind: string, open: boolean) => {
      const s = house(open, kind);
      place(s, 'player', 'tav_common'); s.player.pos = { x: 0, y: -2 };
      s.turn += 1;
      resolveTurn(s, { intent: { move: { toZone: 'street_door', jump: true }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null }, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1));
      return s.player.zone;
    };
    expect(tryJump(BK.barred_window, false)).toBe('tav_common');
    expect(tryJump(BK.arrow_slit, false)).toBe('tav_common');
    expect(tryJump(BK.large_window, true)).toBe('street_door');
  });
});
