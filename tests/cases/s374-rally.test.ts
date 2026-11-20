// 374 Rally (TC39 a, Command 100): a projected aura triggered by its move, the turn's main action, once a fight. Each
// ally the call reaches makes the rally roll (TC43 a) with the owner's Command: morale back per tier above Near Miss,
// Rallied, and a lifted break (TC42 a). Foes and the owner get nothing.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { maxMorale, moraleLost } from '../../src/ruleset/morale';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const call = intent({ perkMove: { perk: PK.rally, target: null } } as never);
/** the player owns Rally; patron_1 is an opposed foe beside them; the trader is a friend who broke fighting guard_1 */
const setup = () => {
  const s = makeVillage();
  give(s.player, PK.rally);
  s.player.core.skills[SK.command] = { raw: 200, state: 'normal' };
  place(s, 'patron_1', s.player.zone);
  npc(s, 'patron_1').mind!.overrides = { player: 'opposed' };
  const ally = npc(s, 'trader');
  place(s, 'trader', s.player.zone);
  ally.mind!.overrides = { player: 'friend', guard_1: 'yielded' };
  ally.mind!.moraleState = 'broken';
  ally.core.condition.moraleLost = 1.05 * maxMorale(ally);
  ally.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
  return { s, ally };
};

describe('374 Rally', () => {

  it('a Loud call: the broken ally rolls with the owner\'s Command, gets morale back and fights again; the foe and the owner get nothing', () => {
    const { s, ally } = setup();
    const before = moraleLost(s.player);
    const ev = play(s, { intent: call });
    const ev0 = ev.find((e) => e.kind === 'rally' && e.actorId === 'player')!;
    expect(ev0.noise).toBe('loud');
    const onAlly = ev0.effects.find((f) => f.actorId === 'trader')!;
    expect(onAlly).toMatchObject({ kind: 'rallied', data: { by: 'player', perk: PK.rally } });
    expect(onAlly.data.tiers).toBeGreaterThan(0);
    expect(moraleLost(ally)).toBeLessThan(maxMorale(ally));
    expect(ally.mind!.moraleState).toBeUndefined();
    expect(ally.engagement?.rallied).toBe(true);
    expect(ev0.effects.some((f) => f.actorId === 'patron_1' || f.actorId === 'player')).toBe(false);
    expect(moraleLost(s.player)).toBeGreaterThanOrEqual(before);
    // once a fight
    const ev2 = play(s, { intent: call });
    expect(ev2.some((e) => e.kind === 'rally')).toBe(false);
  });
});
