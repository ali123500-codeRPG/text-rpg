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
import { FIGHT_RULES } from '../../src/library/fightRules';
import { FX } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameEvent, GameState } from '../../src/types';

const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
/** the guard, a step from the way into the street square, fights the player, who holds a shortbow at `at` */
function archerDuel(at: { zone: string; x: number }) {
  const s = makeVillage();
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.pos = { x: 31, y: -14 };
  place(s, 'player', at.zone);
  s.player.pos = { x: at.x, y: -14 };
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
  it('rows sit after B4 and before B5: F1 30, F2 50, F3 75 (the whole order is in s376)', () => {
    const ids = FIGHT_RULES.map((r) => r.id);
    expect(ids.slice(ids.indexOf(FX.out_of_sight), ids.indexOf(FX.finish_hurt))).toEqual([FX.out_of_sight, FX.into_cover, FX.into_dark]);
    expect(ids.indexOf(FX.back_off)).toBeLessThan(ids.indexOf(FX.out_of_sight));
    expect(FIGHT_RULES.filter((r) => r.skill === SK.fieldcraft).map((r) => r.min)).toEqual([30, 50, 75]);
  });

  it('F2: a foe with a bow in sight, more cover one move off: it walks there (Fieldcraft 50); below 50, or with no better cover, it does not', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    zoneById(s, 'street_square')!.cover = 'some';
    skill(g, SK.fieldcraft, 49);
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
    skill(g, SK.fieldcraft, 50);
    expect(tacticsOf(s, g)?.intoCover).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', moveSpot: { near: 'gate_inner' }, rule: FX.into_cover });
    zoneById(s, 'gate_inner')!.cover = 'some'; // no more cover there than here
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
  });

  it('F2 is too far when the cover is beyond one move, and never fires with a foe near enough to strike', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    zoneById(s, 'street_square')!.cover = 'some';
    skill(g, SK.fieldcraft, 100);
    g.pos = { x: 49, y: -14 }; // 19 m from the doorway: beyond one move
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
    g.pos = { x: 31, y: -14 };
    s.player.pos = { x: 32, y: -14 }; // the archer stands beside it
    expect(tacticsOf(s, g)?.intoCover).toBeUndefined();
  });

  it('F1: shot at from beyond reach, it walks where the shooter can\'t see (Fieldcraft 30); not shot, it does not', () => {
    const { s, g } = archerDuel({ zone: 'field_edge', x: 70 });
    for (const [a, b] of [['gate_inner', 'street_square'], ['street_square', 'gate_inner']]) zoneById(s, a)!.links.find((l) => l.to === b)!.sight = false;
    skill(g, SK.fieldcraft, 30);
    expect(tacticsOf(s, g)?.outOfSight).toBeUndefined();
    shotAt(s, g);
    expect(tacticsOf(s, g)?.outOfSight).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', rule: FX.out_of_sight });
  });

  it('F3: a darker zone one move off, from where it still sees its foe clearly (Fieldcraft 75); too far to see clearly, it stays', () => {
    const { s, g } = archerDuel({ zone: 'gate_inner', x: 45 });
    for (const id of ['gate_inner', 'street_square']) delete zoneById(s, id)!.outdoor;
    zoneById(s, 'street_square')!.light = 'dim';
    skill(g, SK.fieldcraft, 75);
    expect(tacticsOf(s, g)?.intoDark).toEqual({ zone: 'street_square', via: 'gate_inner' });
    expect(orderOf(s, g)).toMatchObject({ type: 'idle', move: 'street_square', rule: FX.into_dark });
    s.player.pos = { x: 49, y: -14 }; // still clear (20 m from the doorway)
    expect(tacticsOf(s, g)?.intoDark).toBeDefined();
    place(s, 'player', 'field_edge');
    s.player.pos = { x: 70, y: -14 }; // 41 m: only half seen from there
    expect(tacticsOf(s, g)?.intoDark).toBeUndefined();
  });
});
