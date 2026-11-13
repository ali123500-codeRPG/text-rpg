// 268 Passing on essences (AT75, ES1–ES7): an offer the player hasn't taken can be given to someone in reach with room
// (a unique NPC's slots), or sold at the buying price for its value (one equation with items) to a seller, who may hold it to
// sell on, or to a unique NPC with room.
import { describe, expect, it } from 'vitest';
import { now } from '../../src/time';
import type { Actor, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { beside } from '../harness/village';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { ES } from '../../src/library/essenceIds';
import { IT } from '../../src/library/itemIds';
import { CL } from '../../src/library/classIds';
import { essenceSkill } from '../../src/ruleset/perks';
import { essenceValue, giveEssence, sellEssence } from '../../src/engine/essence';
import { coins } from '../../src/engine/trade';

const offer = (s: GameState) => { (s.player.progression!.essenceOffers ??= []).push({ essence: ES.gate_habit, grade: 'common', points: { [SK.eyesight]: 4, [SK.parry]: 3 }, turn: s.turn, from: 'a guard', source: 'foe', untilMin: now(s) + 10 }); };
const unique = (a: Actor) => { a.core.generation = 'unique'; a.progression = { startingTotal: 0, potential: { base: 300, adjustments: [] }, xp: 0, unspentPerkPoints: 0, marks: [] }; };
const purse = (a: Actor, n: number) => { a.core.inventory = a.core.inventory.filter((i) => i.itemId !== IT.coin); a.core.inventory.push({ id: `purse_${a.id}`, itemId: IT.coin, qty: n }); };

describe('268 passing on essences', () => {
  it('ES5 a: value = points × the gear skill-point rate × ESSENCE_VALUE_MULT', () => {
    expect(essenceValue({ points: { a: 4, b: 3 } })).toBe(7 * CONFIG.ITEM_VALUE.skillPoint * CONFIG.ESSENCE_VALUE_MULT);
  });

  it('ES3/ES4: a gift goes into a unique NPC\'s slot with no yes needed; someone without a record, or out of reach, can\'t take it', () => {
    const s = makeVillage(), wim = s.actors.find((a) => a.id === 'patron_1')!;
    beside(s, 'patron_1', 'player');
    offer(s);
    expect(giveEssence(s, 0, wim)).toMatch(/no room/); // a copy keeps no progression record
    unique(wim);
    expect(giveEssence(s, 0, wim)).toBeNull();
    expect(s.player.progression!.essenceOffers).toBeUndefined();
    expect(essenceSkill(wim, SK.eyesight)).toBe(4); // thread: true skill, as for the player
    expect(s.hidden.memory[wim.id]?.at(-1)?.text).toMatch(/gave me an essence/);
    offer(s);
    expect(giveEssence(s, 0, wim)).toMatch(/no room/); // one slot at his level, now full
    const guard = s.actors.find((a) => a.id === 'guard_1')!;
    unique(guard);
    expect(giveEssence(s, 0, guard)).toMatch(/out of reach/);
  });

  it('ES6 a: a seller pays the buying price for its value and holds it to sell on; with too little coin it refuses', () => {
    const s = makeVillage({ playerZone: 'tav_counter' }), mags = s.actors.find((a) => a.id === 'trader')!;
    mags.wares ??= { items: [], services: [] };
    if (!mags.core.classes.some((c) => c.classId === CL.trader)) mags.core.classes.push({ classId: CL.trader, level: 1 } as never);
    offer(s);
    const price = Math.floor(essenceValue(s.player.progression!.essenceOffers![0]) * CONFIG.SELL_SHARE);
    purse(mags, price - 1);
    expect(sellEssence(s, 0, mags)).toEqual({ error: expect.stringMatching(/can't pay/) });
    purse(mags, price);
    const before = coins(s.player);
    expect(sellEssence(s, 0, mags)).toEqual({ price });
    expect(coins(s.player)).toBe(before + price);
    expect(mags.essenceStock?.map((e) => e.essence)).toEqual([ES.gate_habit]);
  });

  it('ES6: a unique NPC who is no seller buys one into a free slot; anyone else doesn\'t buy', () => {
    const s = makeVillage(), wim = s.actors.find((a) => a.id === 'patron_1')!;
    beside(s, 'patron_1', 'player');
    purse(wim, 500);
    offer(s);
    expect(sellEssence(s, 0, wim)).toEqual({ error: expect.stringMatching(/doesn't buy/) });
    unique(wim);
    const r = sellEssence(s, 0, wim);
    expect('price' in r && r.price).toBe(Math.floor(70 * CONFIG.SELL_SHARE * CONFIG.ITEM_VALUE.skillPoint));
    expect(wim.progression!.essences).toHaveLength(1);
  });
});
