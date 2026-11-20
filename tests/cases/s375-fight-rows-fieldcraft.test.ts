// 375 Fight rows, Fieldcraft (D-17, TC18 a, TC25 a): a code-run NPC with the skill walks to a zone within one move,
// in table order after the Battle Sense rows B1, B2 and B4: F1 (30) out of the sight of a foe who shot at it from beyond
// reach, F2 (50) into more cover when a foe it sees holds a ranged weapon, F3 (75) into a darker zone from where it still
// sees every foe it fights clearly. None fires while a foe is near enough to strike it.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { withTactics } from '../../src/views/tactics';
import { fallbackOrder } from '../../src/minds';
import { zoneById } from '../../src/engine/relations';
import { FX } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { setTitleLight } from '../../src/plan/draw';
import { BK, LC, WK } from '../../src/library/tableIds';
import { landCellsUnder } from '../harness/plan';
import { waysOut } from '../../src/plan/where';

const D = 70, X = (x: number) => x + D;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
/** the guard, a step from the way into the street square, fights the player, who holds a shortbow at `at` */
function archerDuel(at: { zone: string; x: number }) {
  // the village moved D m east, so a 100 m land cell edge runs between the square and the gate (clutter is by land cell);
  // the gate's palisade on the square side, with the way through it
  const s = makeVillage({ shape: { tav_common: { rect: { x: D, y: 0, w: 8, d: 8 } }, gate_inner: { walls: { w: WK.wall } } } });
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.pos = { x: X(31), y: -14 };
  place(s, 'player', at.zone);
  s.player.pos = { x: X(at.x), y: -14 };
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.control = 'code';
  g.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  for (const k of [SK.battle_sense, SK.command]) skill(g, k, 0);
  return { s, g };
}
const tacticsOf = (s: GameState, a: Actor) => withTactics(s, a, buildActorView(s, a.id)).tactics;
const orderOf = (s: GameState, a: Actor) => fallbackOrder(withTactics(s, a, buildActorView(s, a.id)), createRng(1));
const shotAt = (s: GameState, g: Actor) => s.events.push({ id: 'shot', turn: s.turn, actorId: 'player', kind: 'attack', zone: s.player.zone, target: g.id, ranged: true,
  effects: [], noise: 'normal', visibility: 'high', perception: { [g.id]: { level: 'full', cue: 'sight' } } } as unknown as GameEvent);

describe('375 Fieldcraft fight rows', () => {

  it('F2: a foe with a bow in sight, more cover one move off: it walks there (Fieldcraft 50); below 50, or with no better cover, it does not', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    landCellsUnder(s, zoneById(s, 'street_square')!.outline, LC.marsh);
    skill(g, SK.fieldcraft, 49);
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
    skill(g, SK.fieldcraft, 50);
    expect(tacticsOf(s, g)?.intoCover).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', moveSpot: { near: 'gate_inner' }, rule: FX.into_cover });
    landCellsUnder(s, zoneById(s, 'gate_inner')!.outline, LC.marsh); // no more cover there than here
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
  });

  it('F2 is too far when the cover is beyond one move, and never fires with a foe near enough to strike', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    landCellsUnder(s, zoneById(s, 'street_square')!.outline, LC.marsh);
    skill(g, SK.fieldcraft, 100);
    g.pos = { x: X(49), y: -14 }; // 19 m from the doorway: beyond one move
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
    g.pos = { x: X(31), y: -14 };
    s.player.pos = { x: X(32), y: -14 }; // the archer stands beside it
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
  });

  it('F1: shot at from beyond reach, it walks where the shooter can\'t see (Fieldcraft 30); not shot, it does not', () => {
    const { s, g } = archerDuel({ zone: 'field_edge', x: 70 });
    waysOut(s, 'gate_inner').find((l) => l.to === 'street_square')!.opening.barrier = 'gate_door'; // a shut door hides the square
    (s.barriers ??= {}).gate_door = { id: 'gate_door', kind: BK.door, grade: 'minor' };
    skill(g, SK.fieldcraft, 30);
    expect(tacticsOf(s, g)?.outOfSight).toBeUndefined();
    shotAt(s, g);
    expect(tacticsOf(s, g)?.outOfSight).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', rule: FX.out_of_sight });
  });

  it('F3: a darker zone one move off, from where it still sees its foe clearly (Fieldcraft 75); too far to see clearly, it stays', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    s.clocks.time = 23 * 60; // night: the sky lights nothing, only the lamps do (PZ5)
    setTitleLight(s, zoneById(s, 'gate_inner')!, 'lamplit');
    setTitleLight(s, zoneById(s, 'street_square')!, 'dim');
    skill(g, SK.fieldcraft, 75);
    expect(tacticsOf(s, g)?.intoDark).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', rule: FX.into_dark });
    s.player.pos = { x: X(49), y: -14 }; // still clear (20 m from the doorway)
    expect(tacticsOf(s, g)?.intoDark).toBeDefined();
    place(s, 'player', 'field_edge');
    s.player.pos = { x: X(70), y: -14 }; // 41 m: only half seen from there
    expect(tacticsOf(s, g)?.intoDark).toBeUndefined();
  });
});
