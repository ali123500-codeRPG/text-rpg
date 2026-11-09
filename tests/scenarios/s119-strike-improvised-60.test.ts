// 119 Set Them Up (B15, Strike 60) and One-Two (B16, Improvisation 60) (R6 in "40 milestone perks: options").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { afterAttack, expireMarks, markShifts } from '../../src/engine/perkMarks';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const holdImprovised = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bottle', itemId: 'improvised_light', name: 'bottle', equippedIn: ['hand:right_arm'] } as never);
};
afterEach(() => vi.restoreAllMocks());

describe('119 Set Them Up', () => {
  const miss = { attack: { tierShifts: [] }, defense: null, gap: null, outcome: 'missed' } as unknown as AttackResult;
  it('a Strike attempt, even a miss, sets up the next improvised attack on that foe, and the mark is spent once used', () => {
    const s = makeVillage();
    const p = s.player, foe = npc(s, 'patron_1');
    give(p, 'set_them_up');
    afterAttack(s, p, foe, miss, false, 'unarmed_strike');
    expect(markShifts(s, p, foe, false, 'unarmed_improvised').attack).toEqual([{ source: 'Set Them Up', value: 1 }]);
    expect(markShifts(s, p, foe, false, 'unarmed_strike').attack).toEqual([]);
    expect(markShifts(s, p, npc(s, 'trader'), false, 'unarmed_improvised').attack).toEqual([]);
    // the improvised attack uses it, and in turn sets up the next Strike
    const used = { ...miss, attack: { tierShifts: [{ source: 'Set Them Up', value: 1 }] } } as unknown as AttackResult;
    afterAttack(s, p, foe, used, false, 'unarmed_improvised');
    expect(markShifts(s, p, foe, false, 'unarmed_improvised').attack).toEqual([]);
    expect(markShifts(s, p, foe, false, 'unarmed_strike').attack).toEqual([{ source: 'Set Them Up', value: 1 }]);
  });
  it('needs the perk, and the marks end with the engagement', () => {
    const s = makeVillage();
    const p = s.player, foe = npc(s, 'patron_1');
    afterAttack(s, p, foe, miss, false, 'unarmed_strike');
    expect(markShifts(s, p, foe, false, 'unarmed_improvised').attack).toEqual([]);
    give(p, 'set_them_up');
    afterAttack(s, p, foe, miss, false, 'unarmed_strike');
    delete p.engagement;
    expireMarks(s, p);
    expect(markShifts(s, p, foe, false, 'unarmed_improvised').attack).toEqual([]);
  });
});

describe('119 One-Two', () => {
  const run = (perk: boolean, outcome: AttackResult['outcome'], emptyHand = true) => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    holdImprovised(s);
    if (!emptyHand) s.player.core.inventory.push({ id: 'dag', itemId: 'dagger', equippedIn: ['hand:left_arm'] });
    if (perk) give(s.player, 'one_two');
    const calls: string[] = [];
    const real = ruleset.attack;
    vi.spyOn(ruleset, 'attack').mockImplementation((req, st, rng) => {
      calls.push(req.weaponId);
      const r = real(req, st, forcedRng([50, 50, 50, 50]));
      return req.weaponId === 'bottle' ? { ...r, outcome, damage: 0 } : r;
    });
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'bottle', skill: 'unarmed_improvised' } }) });
    return calls;
  };
  it('an improvised hit with the other hand empty is followed by a free punch at the same foe', () => {
    const calls = run(true, 'full_hit');
    expect(calls[0]).toBe('bottle');
    expect(calls.length).toBe(2);
    expect(calls[1]).not.toBe('bottle');
  });
  it('no punch on a miss, without the perk, or with the other hand full', () => {
    expect(run(true, 'missed').length).toBe(1);
    expect(run(false, 'full_hit').length).toBe(1);
    expect(run(true, 'full_hit', false).length).toBe(1);
  });
});
