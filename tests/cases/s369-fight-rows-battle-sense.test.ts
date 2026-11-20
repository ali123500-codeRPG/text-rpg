// 369 Fight rows, Battle Sense (D-17, TC17, TC21, TC23): a code-run NPC uses the FIGHT_RULES rows its skill reaches, in
// table order, before today's attack: B1 call for help when outnumbered (once a fight), B2 gang up on a foe an ally fights
// within one move, B4 back off toward a bandmate who isn't fighting when Wounded and outnumbered, B5 strike the foe that
// looks most hurt. A bandmate's Command it hears lifts every row (TC7).
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { commandLent, rowsOf, withTactics } from '../../src/views/tactics';
import { fallbackOrder, tacticsOrder } from '../../src/minds';
import { FIGHT_RULES } from '../../src/library/fightRules';
import { FX } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameState } from '../../src/types';

const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const engage = (s: GameState, a: Actor, b: Actor) => {
  a.mind!.knowledge[b.id] = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: b.zone, lastSeenTurn: s.turn };
};
/** patron_1 fights the player, and the guard fights patron_1 beside the player: patron_1 is outnumbered two to one */
const outnumbered = () => {
  const s = makeVillage();
  const patron = place(s, 'patron_1', s.player.zone);
  const guard = place(s, 'guard_1', s.player.zone);
  patron.mind!.overrides = { player: 'hostile', guard_1: 'hostile' };
  guard.mind!.overrides = { patron_1: 'hostile' };
  engage(s, patron, s.player); engage(s, guard, patron);
  return { s, patron, guard };
};
const orderOf = (s: GameState, a: Actor) => fallbackOrder(withTactics(s, a, buildActorView(s, a.id)), createRng(1));

describe('369 Battle Sense fight rows', () => {

  it('B1: outnumbered with Battle Sense 20 it calls for help, once a fight; without it, it attacks as before', () => {
    const { s, patron } = outnumbered();
    skill(patron, SK.battle_sense, 0);
    expect(orderOf(s, patron).type).toBe('attack');
    skill(patron, SK.battle_sense, 20);
    const v = withTactics(s, patron, buildActorView(s, patron.id));
    expect(v.tactics?.outnumbered).toBe(true);
    expect(orderOf(s, patron)).toMatchObject({ type: 'call_help', rule: FX.call_help });
    patron.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
    patron.mind!.rowsUsed = { [FX.call_help]: s.turn - 1 }; // a call in an earlier fight does not count
    expect(orderOf(s, patron).type).toBe('call_help');
    patron.mind!.rowsUsed = { [FX.call_help]: s.turn };
    expect(orderOf(s, patron).type).toBe('attack');
  });

  it('the view the Planner gets carries no tactics', () => {
    const { s, patron } = outnumbered();
    skill(patron, SK.battle_sense, 80);
    expect(buildActorView(s, patron.id).tactics).toBeUndefined();
  });

  it('TC7: a bandmate it hears lends its Command to every row; out of earshot it does not', () => {
    const { s, patron } = outnumbered();
    skill(patron, SK.battle_sense, 0);
    const trader = place(s, 'trader', s.player.zone);
    skill(trader, SK.command, 80);
    expect(commandLent(s, patron)).toBe(80);
    expect(rowsOf(s, patron)).toEqual(FIGHT_RULES.map((r) => r.id));
    place(s, 'trader', 'field_far');
    expect(commandLent(s, patron)).toBe(0);
    expect(rowsOf(s, patron)).toEqual([]);
  });

  it('B2, B4, B5 give their orders; the first row whose situation holds wins', () => {
    const s = makeVillage();
    const patron = place(s, 'patron_1', s.player.zone);
    const view = buildActorView(s, patron.id);
    const rows = FIGHT_RULES.map((r) => r.id);
    const run = (t: object, health = 'unhurt') => tacticsOrder({ ...view, self: { ...view.self, health: health as never }, tactics: { rows, ...t } });
    expect(run({ allyFoe: 'player', hurtFoe: 'guard_1' })).toMatchObject({ type: 'attack', target: 'player', rule: FX.gang_up });
    expect(run({ outnumbered: true, calledHelp: true, freeAlly: { id: 'trader', zone: 'tav_counter' } }, 'wounded'))
      .toMatchObject({ type: 'idle', move: 'tav_counter', moveSpot: { near: 'trader' }, rule: FX.back_off });
    expect(run({ outnumbered: true, calledHelp: true, freeAlly: { id: 'trader', zone: 'tav_counter' } }, 'injured')).toBeNull(); // not yet Wounded
    expect(run({ hurtFoe: 'guard_1' })).toMatchObject({ type: 'attack', target: 'guard_1', rule: FX.finish_hurt });
    expect(tacticsOrder({ ...view, tactics: { rows: [FX.call_help], hurtFoe: 'guard_1' } })).toBeNull(); // a row it lacks never fires
  });

  it('B2 finds the foe an ally fights within one move', () => {
    const s = makeVillage();
    const patron = place(s, 'patron_1', s.player.zone);
    const trader = place(s, 'trader', s.player.zone);
    patron.mind!.overrides = { player: 'hostile' };
    trader.mind!.overrides = { player: 'hostile' };
    engage(s, trader, s.player); engage(s, patron, s.player);
    skill(patron, SK.battle_sense, 35);
    expect(withTactics(s, patron, buildActorView(s, patron.id)).tactics?.allyFoe).toBe('player');
    expect(orderOf(s, patron)).toMatchObject({ type: 'attack', target: 'player', rule: FX.gang_up });
  });

});
