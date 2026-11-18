// 372 Tactics 20 perks, first three (TC28 a, TC36 c, TC30 a): Press the Opening (Battle Sense 20), Fall Back on Me
// (Command 20) and Hug the Cover (Fieldcraft 20).
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { afterAttack, hugReady, markShifts } from '../../src/engine/perkMarks';
import { fallBackOwner, nerveLetsWalk, walksAway } from '../../src/engine/nerve';
import { zoneById } from '../../src/engine/relations';
import { buildActorView } from '../../src/views';
import { brokenOrder } from '../../src/minds';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, AttackResult, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const hit = (outcome: string, shifts: { source: string; value: number }[] = []) => ({ outcome, attack: { tierShifts: shifts }, gap: 0, defenseType: 'dodge', defense: null } as unknown as AttackResult);

describe('372 Tactics 20 perks', () => {
  it('sit on the 20 milestones of Battle Sense, Command and Fieldcraft, all built', () => {
    const L = getLibrary().perks;
    expect([PK.press_the_opening, PK.fall_back_on_me, PK.hug_the_cover].map((id) => L[id]?.ladder)).toEqual([
      { skill: SK.battle_sense, milestone: 20 }, { skill: SK.command, milestone: 20 }, { skill: SK.fieldcraft, milestone: 20 }]);
    for (const id of [PK.press_the_opening, PK.fall_back_on_me, PK.hug_the_cover]) expect(BUILT_PERKS.has(id)).toBe(true);
  });

  it('Press the Opening: an ally hits a foe, the owner\'s next attack on it is one outcome better, then spent', () => {
    const s = makeVillage();
    const guard = place(s, 'guard_1', s.player.zone), patron = place(s, 'patron_1', s.player.zone);
    patron.mind!.overrides = { player: 'hostile', guard_1: 'hostile' };
    guard.mind!.overrides = { player: 'friendly', patron_1: 'hostile' };
    give(s.player, PK.press_the_opening);
    afterAttack(s, guard, patron, hit('missed'), false);
    expect(markShifts(s, s.player, patron, false).attack).toEqual([]);
    afterAttack(s, guard, patron, hit('grazed'), false);
    expect(markShifts(s, s.player, patron, false).attack).toEqual([{ source: 'Press the Opening', value: 1 }]);
    expect(markShifts(s, s.player, guard, false).attack).toEqual([]); // only on that foe
    afterAttack(s, s.player, patron, hit('missed', [{ source: 'Press the Opening', value: 1 }]), false);
    expect(markShifts(s, s.player, patron, false).attack).toEqual([]);
    give(guard, PK.press_the_opening);
    afterAttack(s, guard, patron, hit('full_hit'), false);
    expect(markShifts(s, guard, patron, false).attack).toEqual([]); // its own hit opens nothing for itself
  });

  it('Hug the Cover: in cover, the first ranged attack on the owner each turn is one outcome worse', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    const slime = npc(s, 'slime_1');
    zoneById(s, 'field_edge')!.cover = 'some';
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    give(slime, PK.hug_the_cover);
    place(s, 'slime_1', 'field_edge');
    zoneById(s, 'field_edge')!.cover = 'some';
    const shot = () => ruleset.attack({ attackerId: 'player', targetId: 'slime_1', weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([60, 50, 50]));
    expect(hugReady(s, slime)).toBe(true);
    const r = shot();
    expect(r.attack.tierShifts).toContainEqual({ source: 'Hug the Cover', value: -1 });
    afterAttack(s, s.player, slime, r, true);
    expect(hugReady(s, slime)).toBe(false);
    expect(shot().attack.tierShifts.some((t) => t.source === 'Hug the Cover')).toBe(false); // the second this turn
    s.turn += 1;
    zoneById(s, 'field_edge')!.cover = 'none';
    expect(shot().attack.tierShifts.some((t) => t.source === 'Hug the Cover')).toBe(false); // no cover
  });

  it('Fall Back on Me: a broken ally in earshot may walk toward the owner, past a foe; a code-run one runs there', () => {
    const s = makeVillage();
    const patron = place(s, 'patron_1', 'tav_common'), trader = place(s, 'trader', 'tav_common');
    place(s, 'player', 'tav_common');
    patron.mind!.overrides = { player: 'hostile' };
    patron.mind!.moraleState = 'broken';
    expect(fallBackOwner(s, patron)).toBeUndefined();
    give(trader, PK.fall_back_on_me);
    expect(fallBackOwner(s, patron)?.id).toBe('trader');
    const near = { zone: trader.zone, pos: { ...trader.pos! } };
    expect(nerveLetsWalk(s, patron, near)).toBe(true); // toward the owner: allowed whatever foes stand by
    trader.core.perks = [];
    expect(nerveLetsWalk(s, patron, near)).toBe(walksAway(s, patron, near)); // without it, only away
    give(trader, PK.fall_back_on_me);
    const o = brokenOrder(buildActorView(s, patron.id));
    expect(o).toMatchObject({ type: 'idle', move: trader.zone, moveSpot: { near: 'trader' } });
  });
});

describe('372 Draw Them In (TC31 a)', () => {
  it('a free move once a fight: a foe that sees it and loses comes at the owner next turn, and the owner gets +1 on it', async () => {
    const { play, intent } = await import('./w4-kit');
    const s = makeVillage();
    const patron = place(s, 'patron_1', s.player.zone);
    patron.mind!.overrides = { player: 'hostile' };
    patron.mind!.control = 'code';
    patron.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
    patron.core.skills[SK.insight] = { raw: 0, state: 'normal' };
    give(s.player, PK.draw_them_in);
    s.player.core.skills[SK.stratagem] = { raw: 200, state: 'normal' }; // sure to win
    const ev = play(s, { intent: intent({ perkMove: { perk: PK.draw_them_in, target: null } } as never) });
    const pm = ev.find((e) => e.kind === 'perk_move' && e.actorId === 'player')!;
    expect(pm.effects).toContainEqual(expect.objectContaining({ kind: 'drawn_in', actorId: 'patron_1' }));
    expect(markShifts(s, s.player, patron, false).attack).toContainEqual({ source: 'Draw Them In', value: 1 });
    // its next turn: an attack on the player, whatever it chose
    const ev2 = play(s, { intent: intent() });
    expect(ev2.some((e) => e.kind === 'attack' && e.actorId === 'patron_1' && e.target === 'player')).toBe(true);
    // once a fight
    const ev3 = play(s, { intent: intent({ perkMove: { perk: PK.draw_them_in, target: null } } as never) });
    expect(ev3.some((e) => e.kind === 'perk_move' && e.actorId === 'player')).toBe(false);
  });

  it('the drawn foe\'s order is replaced by an attack on the owner, even when its agent chose to hold', async () => {
    const { plannerOut, act } = await import('./w4-kit');
    const { mergeOrders } = await import('../../src/engine/merge');
    const { drawIn } = await import('../../src/engine/perkMarks');
    const s = makeVillage();
    const patron = place(s, 'patron_1', s.player.zone);
    patron.mind!.overrides = { player: 'hostile' };
    drawIn(s, s.player, patron);
    const views = new Map([[patron.id, buildActorView(s, patron.id)]]);
    const input = { intent: null, aimed: false, agentOutputs: [plannerOut(patron.id, act('hold'))], spokespeople: [] };
    const o = mergeOrders(s, input as never, views, [], forcedRng([50]));
    expect(o.get(patron.id)).toMatchObject({ type: 'attack', target: 'player', intent: 'drawn in' });
    expect(mergeOrders(s, input as never, views, [], forcedRng([50])).get(patron.id)?.type).toBe('hold'); // spent
  });
});
