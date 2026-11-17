// 367 BG-301 (Tactics TC42 a) and the Rallied buff (TC41 a). A rally (Battle Cry's; Rally later) reaches broken allies:
// once morale lost is back under 100 % of max the break ends, and the ally stops yielding to those it fought. A spoken
// surrender stays. Every rally gives Rallied: CONFIG.RALLIED_MOD on every roll until the fight ends, no stacking.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { liftBreak } from '../../src/engine/auras';
import { maxMorale, moraleLost } from '../../src/ruleset/morale';
import { ruleset } from '../../src/ruleset';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { createRng } from '../harness';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const cry = intent({ perkMove: { perk: PK.battle_cry, target: null } } as never);
/** the player owns Battle Cry; patron_1 is an opposed foe; the trader is a friend who broke while fighting guard_1 */
const setup = (lostShare: number, state: 'broken' | 'surrendered' = 'broken') => {
  const s = makeVillage();
  give(s.player, PK.battle_cry);
  s.player.core.skills[SK.intimidation] = { raw: 140, state: 'normal' };
  place(s, 'patron_1', s.player.zone);
  npc(s, 'patron_1').mind!.overrides = { player: 'opposed' };
  const ally = npc(s, 'trader');
  place(s, 'trader', s.player.zone);
  ally.mind!.overrides = { player: 'friend', guard_1: 'yielded' };
  ally.mind!.moraleState = state;
  ally.core.condition.moraleLost = lostShare * maxMorale(ally);
  return { s, ally };
};

describe('367 Rallies reach broken allies (BG-301) and give Rallied', () => {
  it('a broken ally rallied back under 100 % stops being broken and fights the one it yielded to', () => {
    const { s, ally } = setup(1.05);
    play(s, { intent: cry });
    expect(moraleLost(ally)).toBeLessThan(maxMorale(ally));
    expect(ally.mind!.moraleState).toBeUndefined();
    expect(ally.mind!.overrides?.guard_1).toBe('hostile');
  });

  it('a rally that leaves it still over 100 % lost keeps the break', () => {
    const { s, ally } = setup(CONFIG.MORALE_COWER_AT);
    const before = moraleLost(ally);
    play(s, { intent: cry });
    expect(moraleLost(ally)).toBeLessThan(before); // helped, not skipped
    expect(moraleLost(ally)).toBeGreaterThanOrEqual(maxMorale(ally));
    expect(ally.mind!.moraleState).toBe('broken');
  });

  it('a spoken surrender stays', () => {
    const { s, ally } = setup(0.5, 'surrendered');
    expect(liftBreak(s, ally)).toBe(false);
    expect(ally.mind!.moraleState).toBe('surrendered');
    expect(ally.mind!.overrides?.guard_1).toBe('yielded');
  });

  it('Rallied adds RALLIED_MOD to every roll for the rest of the fight, once', () => {
    const { s } = setup(0.2);
    play(s, { intent: cry });
    expect(s.player.engagement?.rallied).toBe(true);
    const r = ruleset.roll({ actorId: 'player', skill: SK.intimidation, modifiers: [], tierShifts: [] }, s, createRng(1));
    expect(r.modifiers.filter((m) => m.source === 'Rallied')).toEqual([{ source: 'Rallied', type: 'status', value: CONFIG.RALLIED_MOD }]);
    delete s.player.engagement;
    const r2 = ruleset.roll({ actorId: 'player', skill: SK.intimidation, modifiers: [], tierShifts: [] }, s, createRng(1));
    expect(r2.modifiers.some((m) => m.source === 'Rallied')).toBe(false);
  });
});
