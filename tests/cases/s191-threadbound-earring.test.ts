// 191 Threadbound items (D-218): the Varo's Loop, one of a kind. It binds to the first who wears it; while its owner
// wears it, each ability opens once the owner has earned its event-roll achievement. Every ability widens the event roll
// both ways: wider natural edges, more tiers past each Critical, a spread die, and two armed actives.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { intent, play } from './w4-kit';
import { ruleset, tierName } from '../../src/ruleset';
import { tierReach } from '../../src/ruleset/achRewards';
import { syncThreadboundItemPerks } from '../../src/ruleset/threadboundItems';
import { applyGearOps } from '../../src/engine/gear';
import { perkMoveBlock } from '../../src/engine/perkMoves';
import { tidyRewards } from '../../src/scenario/validate';
import { advanceClock } from '../../src/time';
import { ACH } from '../../src/library/achievementIds';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';
import type { Actor, GameState, StagePlan } from '../../src/types';

const LOOP = 'loop_1';
const earn = (a: Actor, ...keys: string[]) => keys.forEach((key) => ((a.progression ??= {} as never).achievements ??= []).push({ key, turn: 0 } as never));
const has = (a: Actor, perk: string) => a.core.perks.some((p) => p.perkId === perk && p.source === 'item');
/** the player carries the loop and has put it on */
const worn = (earned: string[] = []) => {
  const s = makeVillage();
  s.player.core.inventory.push({ id: LOOP, itemId: IT.varos_loop });
  applyGearOps(s, s.player, [{ op: 'wear_acc', item: LOOP }]);
  earn(s.player, ...earned);
  syncThreadboundItemPerks(s.player, s.turn);
  return s;
};
const ev = (s: GameState, ...d: number[]) => ruleset.eventRoll(s.player, s, forcedRng(d));

describe('191 the Varo\'s Loop', () => {
  it('binds to the first who wears it and gives nothing in anyone else\'s hands', () => {
    const s = worn([ACH.event_crit_1]);
    const inst = s.player.core.inventory.find((i) => i.id === LOOP)!;
    expect(inst.boundTo).toBe('player');
    // even worn by someone else by force, it gives them nothing (nobody else can put it on: s192)
    expect(has(s.player, PK.loose_odds)).toBe(true);
    const other = s.actors[0];
    other.core.inventory.push({ ...inst, id: 'loop_2', equippedIn: ['acc:0'] });
    earn(other, ACH.event_crit_1);
    syncThreadboundItemPerks(other, s.turn);
    expect(has(other, PK.loose_odds)).toBe(false);
  });

  it('abilities follow achievements and leave when it comes off', () => {
    const s = worn();
    expect(s.player.core.perks.some((p) => p.source === 'item')).toBe(false);
    earn(s.player, ACH.event_crit_fail_1);
    syncThreadboundItemPerks(s.player, s.turn);
    expect(has(s.player, PK.twin_abyss)).toBe(true);
    applyGearOps(s, s.player, [{ op: 'remove_acc', item: LOOP }]);
    syncThreadboundItemPerks(s.player, s.turn);
    expect(has(s.player, PK.twin_abyss)).toBe(false);
  });

  it('Loose Odds shifts the 5 naturals just inside each critical range a tier outward, wherever opened tiers put it', () => {
    // its own achievement opens a tier above, so 91-100 is the critical range there; nothing is opened below
    const at = (d: number, loop = true) => {
      const s = worn([ACH.event_crit_1]);
      if (!loop) s.player.core.perks = s.player.core.perks.filter((p) => p.source !== 'item');
      return tierName(ev(s, d));
    };
    expect(at(88)).toBe('Critical Success'); // 86-90 raise a tier
    expect(at(88, false)).toBe('Great Success');
    expect(at(85)).toBe('Great Success');
    expect(at(8)).toBe('Critical Failure'); // 06-10 drop one
    expect(at(8, false)).toBe('Failure');
  });

  it('Twin Abyss and Further Still open tiers past each Critical', () => {
    expect(tierReach(worn([ACH.event_crit_fail_1]).player, 'event')).toEqual({ up: 1, down: 2 }); // the scar's own + the loop's
    const both = worn([ACH.event_crit_fail_1, ACH.event_crit_fail_3]);
    const loop = tierReach(both.player, 'event');
    both.player.core.perks = both.player.core.perks.filter((p) => p.source !== 'item');
    const bare = tierReach(both.player, 'event');
    expect({ up: loop.up - bare.up, down: loop.down - bare.down }).toEqual({ up: 2, down: 2 });
  });

  it('Pull to the Edges spreads the die from the middle; modifiers keep their size', () => {
    expect(tierName(ev(worn(), 70))).toBe('Success');
    const s = worn([ACH.event_crit_fail_2]);
    expect(tierName(ev(s, 70))).toBe('Great Success'); // 50.5 + 19.5 × 1.5 = 79.75
    expect(tierName(ev(worn(), 30))).toBe('Near Miss');
    expect(tierName(ev(s, 30))).toBe('Failure'); // 50.5 − 20.5 × 1.5 = 19.75
  });

  it('Call the Toss: a free move that arms the next event roll to keep the die farther from the middle, once a day', () => {
    const s = worn([ACH.event_crit_2]);
    expect(perkMoveBlock(s, s.player, PK.call_the_toss, null)).toBeNull();
    play(s, { intent: intent({ perkMove: { perk: PK.call_the_toss, target: null } } as never) });
    const inst = s.player.core.inventory.find((i) => i.id === LOOP)!;
    expect(inst.armed).toBe(PK.call_the_toss);
    expect(perkMoveBlock(s, s.player, PK.call_the_toss, null)).toBe('already_armed');
    const r = ev(s, 55, 12);
    expect(r.roll).toBe(12);
    expect(r.armed).toBe(PK.call_the_toss);
    expect(inst.armed).toBeUndefined();
    expect(ev(s, 55, 12).roll).toBe(55); // used up
    expect(perkMoveBlock(s, s.player, PK.call_the_toss, null)).toBe('cooldown');
    advanceClock(s, 1440);
    expect(perkMoveBlock(s, s.player, PK.call_the_toss, null)).toBeNull();
  });

  it('All or Nothing lands only on the Critical tiers', () => {
    const s = worn([ACH.event_crit_3]);
    const inst = s.player.core.inventory.find((i) => i.id === LOOP)!;
    inst.armed = PK.all_or_nothing;
    expect(tierName(ev(s, 51))).toBe('Critical Success');
    inst.armed = PK.all_or_nothing;
    expect(tierName(ev(s, 50))).toBe('Critical Failure');
  });

  it('the Weaver does not place Threadbound items (D-220) and cannot mint one', () => {
    const s = makeVillage();
    const zone = s.stage.zoneIds[0];
    const plan = { event: { gain: 'extreme' }, rewards: [{ item: IT.varos_loop, place: { groundIn: zone } }, { item: { base: IT.varos_loop, quality: 1, name: 'x', look: 'x', boosts: 'hitAdj' }, place: { groundIn: zone } }] } as unknown as StagePlan;
    expect(tidyRewards(s, plan).rewards).toHaveLength(0);
  });
});
