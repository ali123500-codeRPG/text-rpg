// 376 Fight rows, Stratagem (D-17, TC19 a, TC23 a): S1 (40) a code-run NPC fighting one foe alone falls back toward a
// bandmate in sight who isn't fighting, so the foe follows into a fight it is outnumbered in; S2 (55) with no foe in
// sight, it sneaks toward the one it hunts instead of closing in openly. S1 sits after B4, S2 last.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { withTactics } from '../../src/views/tactics';
import { fallbackOrder } from '../../src/minds';
import { FIGHT_RULES } from '../../src/library/fightRules';
import { FX } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameState } from '../../src/types';

const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const orderOf = (s: GameState, a: Actor) => fallbackOrder(withTactics(s, a, buildActorView(s, a.id)), createRng(1));
const engage = (s: GameState, a: Actor, b: Actor) => {
  a.mind!.knowledge[b.id] = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: b.zone, lastSeenTurn: s.turn };
};
/** the patron fights the player alone in the common room; the trader, its bandmate, stands idle at the counter */
function alone() {
  const s = makeVillage();
  const patron = npc(s, 'patron_1');
  patron.mind!.overrides = { player: 'hostile' };
  patron.mind!.control = 'code';
  engage(s, patron, s.player);
  for (const k of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(patron, k, 0);
  return { s, patron, trader: npc(s, 'trader') };
}

describe('376 Stratagem fight rows', () => {
  it('rows sit in table order: S1 after B4, S2 then S3 last, at 40, 55 and 70', () => {
    expect(FIGHT_RULES.map((r) => r.id)).toEqual([FX.call_help, FX.gang_up, FX.back_off, FX.draw_into_pack, FX.out_of_sight, FX.into_cover, FX.into_dark, FX.finish_hurt, FX.strike_from_hiding, FX.feigned_flight]);
    expect(FIGHT_RULES.filter((r) => r.skill === SK.stratagem).map((r) => r.min)).toEqual([40, 55, 70]);
  });

  it('S1: alone against one foe, it falls back toward the idle bandmate (Stratagem 40); below 40 it attacks', () => {
    const { s, patron } = alone();
    skill(patron, SK.stratagem, 39);
    expect(orderOf(s, patron).type).toBe('attack');
    skill(patron, SK.stratagem, 40);
    expect(orderOf(s, patron)).toMatchObject({ type: 'idle', move: 'tav_counter', moveSpot: { near: 'trader' }, rule: FX.draw_into_pack });
  });

  it('S1 does not fire with someone already on its side, or with the bandmate close enough to strike', () => {
    const { s, patron, trader } = alone();
    skill(patron, SK.stratagem, 40);
    place(s, 'trader', patron.zone);
    trader.pos = { x: patron.pos!.x + 0.8, y: patron.pos!.y };
    expect(withTactics(s, patron, buildActorView(s, patron.id)).tactics?.drawTo).toBeUndefined();
    const { s: s2, patron: p2 } = alone();
    skill(p2, SK.stratagem, 40);
    const guard = place(s2, 'guard_1', p2.zone);
    guard.mind!.overrides = { player: 'hostile' };
    engage(s2, guard, s2.player); // the guard fights the player beside it: it is not alone
    expect(withTactics(s2, p2, buildActorView(s2, p2.id)).tactics?.drawTo).toBeUndefined();
  });

  it('S2: no foe in sight, it sneaks one way toward the foe it hunts (Stratagem 55); below 55 it closes in openly', () => {
    const s = makeVillage();
    const guard = npc(s, 'guard_1'); // at the gate; the player is in the tavern, out of its sight
    guard.mind!.overrides = { player: 'hostile' };
    guard.mind!.control = 'code';
    guard.mind!.knowledge.player = { status: 'tracking', source: 'seen', revealed: [], lastKnownZone: 'street_square', lastSeenTurn: s.turn - 1 };
    for (const k of [SK.battle_sense, SK.command, SK.fieldcraft]) skill(guard, k, 0);
    skill(guard, SK.stratagem, 54);
    expect(orderOf(s, guard)).toMatchObject({ type: 'move', target: 'street_square' });
    skill(guard, SK.stratagem, 55);
    expect(orderOf(s, guard)).toMatchObject({ type: 'sneak', target: 'street_square', rule: FX.strike_from_hiding });
    // in sight, it closes in openly
    place(s, 'player', 'street_square');
    guard.mind!.knowledge.player.status = 'engaged';
    expect(orderOf(s, guard).type).not.toBe('sneak');
  });
});
