// 115 Leg Bolt (A6) and Dirt in the Eyes (A9) (rules in src/library/perks.ts; action economy AE2, AE5, AE8).
// Leg Bolt: a medium or heavy ranged hit that wounds a leg costs the leg 1.5× and slows the target (no dash) until the
// end of its next turn. Dirt in the Eyes: a free perk move, once per engagement, needing a free hand; unless the foe's
// dodge wins, its next attack or defense roll gets tier shift −2.
import { tick } from '../harness/time';
import { AM } from '../../src/library/tableIds';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage, place, fit } from '../harness';
import { PERK_MOVES, ruleset } from '../../src/ruleset';
import { afterAttack, markShifts, slowed } from '../../src/engine/perkMarks';
import { perkMoveBlock, resolvePerkMove } from '../../src/engine/perkMoves';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import type { Actor, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const crossbow = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'xb', itemId: IT.crossbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  fit(s.player, IT.crossbow);
};
const bolt = { attackerId: 'player', targetId: 'patron_1', weaponId: 'xb', modeId: AM.shoot, targetPart: 'left_leg', aimed: true };
const legLoss = (perk: boolean) => {
  const s = makeVillage();
  crossbow(s);
  if (perk) give(s.player, PK.leg_bolt);
  const r = ruleset.attack(bolt, s, forcedRng([95, 5, 50, 50]));
  ruleset.applyEffects(r, s);
  return { s, r, loss: 100 - (npc(s, 'patron_1').core.condition.parts?.left_leg ?? 100) };
};

describe('115 Leg Bolt', () => {
  it('a crossbow hit on a leg costs the leg 1.5× with the perk, and slows the target until the end of its next turn', () => {
    const plain = legLoss(false), bolted = legLoss(true);
    expect(plain.r.legBolt).toBeUndefined();
    expect(bolted.r.legBolt).toBe(true);
    expect(plain.loss).toBeGreaterThan(0);
    expect(bolted.loss).toBeCloseTo(plain.loss * 1.5, 5);
    const { s, r } = bolted;
    const wim = npc(s, 'patron_1');
    afterAttack(s, s.player, wim, r, true);
    expect(slowed(s, wim)).toBe(true);
    tick(s);
    tick(s); // PERK_MARK_ROUNDS rounds later
    expect(slowed(s, wim)).toBe(false);
  });
  it('a slowed player can’t dash', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    s.player.perkMarks = [{ perk: PK.leg_bolt, made: s.pending.turn }];
    play(s, { intent: intent({ move: { toZone: 'gate_inner' } }) });
    expect(s.player.zone).not.toBe('gate_inner');
    expect(s.log.some((l) => l.code === 'dash_blocked' && (l.detail as { reason: string }).reason === 'slowed')).toBe(true);
  });
});

describe('115 Dirt in the Eyes', () => {
  it('needs the perk, a foe in the zone, a free hand, and works once per engagement', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, wim.id)).toBe('not_owned');
    give(s.player, PK.dirt_in_the_eyes);
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, 'nobody')).toBe('no_target');
    crossbow(s); // both hands on the crossbow
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, wim.id)).toBe('no_free_grip');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, wim.id)).toBeNull();
    resolvePerkMove(s, s.player, PK.dirt_in_the_eyes, wim.id, forcedRng([90, 10]));
    expect(perkMoveBlock(s, s.player, PK.dirt_in_the_eyes, wim.id)).toBe('used_this_engagement');
  });
  it('unless the foe’s dodge wins, its next attack or defense roll gets −2, then the mark is spent', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    give(s.player, PK.dirt_in_the_eyes);
    const hit = resolvePerkMove(s, s.player, PK.dirt_in_the_eyes, wim.id, forcedRng([90, 10]));
    expect(hit.effects[0].kind).toBe('dirt_in_eyes');
    expect(markShifts(s, wim, s.player, false).attack).toEqual([{ source: 'Dirt in the Eyes', value: -2 }]);
    expect(markShifts(s, s.player, wim, false).defense).toEqual([{ source: 'Dirt in the Eyes', value: -2 }]);
    const r = ruleset.attack({ attackerId: 'player', targetId: wim.id, weaponId: `natural:${AM.punch}`, modeId: AM.punch, targetPart: null, aimed: false }, s, forcedRng([50, 50, 50, 50]));
    expect(r.defense?.tierShifts).toContainEqual({ source: 'Dirt in the Eyes', value: -2 });
    afterAttack(s, s.player, wim, r, false);
    expect(wim.perkMarks?.some((m) => m.perk === PK.dirt_in_the_eyes)).toBeFalsy();

    const s2 = makeVillage();
    const w2 = npc(s2, 'patron_1');
    w2.zone = s2.player.zone;
    give(s2.player, PK.dirt_in_the_eyes);
    const miss = resolvePerkMove(s2, s2.player, PK.dirt_in_the_eyes, w2.id, forcedRng([10, 95]));
    expect(miss.effects[0].kind).toBe('dirt_dodged');
    expect(w2.perkMarks).toBeUndefined();
  });
  it('rides beside the main action in a turn: the Parser names it, legality keeps it only when owned, the turn resolves it', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    const i = intent({ perkMove: { perk: PK.dirt_in_the_eyes, target: wim.id }, action: { type: 'attack', skill: SK.unarmed_strike, target: wim.id } });
    expect(checkParserLegality(i, buildPlayerView(s)).intent.perkMove).toBeNull();
    give(s.player, PK.dirt_in_the_eyes);
    for (const it of s.player.core.inventory) delete it.equippedIn; // a free hand
    const pv = buildPlayerView(s);
    expect(pv.player.perkMoves).toEqual([{ id: PK.dirt_in_the_eyes, name: 'Dirt in the Eyes', does: PERK_MOVES[PK.dirt_in_the_eyes].does, inRange: expect.any(Array) }]);
    expect(checkParserLegality(i, pv).intent.perkMove).toEqual({ perk: PK.dirt_in_the_eyes, target: wim.id });
    const perk = deck({ pv, s }).find((g) => g.group === 'perks')?.actions[0];
    expect(perk?.label).toBe('Throw dirt in the eyes');
    expect(perk?.steps[0].key === 'target' && perk.steps[0].picks({}).map((p) => p.id)).toContain(wim.id);
    const ev = play(s, { intent: i });
    const pm = ev.findIndex((e) => e.kind === 'perk_move' && e.actorId === 'player');
    const atk = ev.findIndex((e) => e.kind === 'attack' && e.actorId === 'player');
    expect(pm).toBeGreaterThanOrEqual(0);
    expect(atk).toBeGreaterThan(pm); // free, and before the main action
  });
});
