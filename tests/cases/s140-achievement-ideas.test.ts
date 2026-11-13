// 140 achievement ideas N1–N9: clean defenses, aimed hits per part size (smaller pays more), coin spent buying, contests
// won against better opponents, back from Down, mended parts, enemies turned friendly, and the quest shapes (per giver,
// many givers, a finished run of follow-ups, early, unpaid).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { turnFeats, contestFeat } from '../../src/engine/feats';
import { achLevel, achievementName, tally } from '../../src/engine/xp';
import { handInQuests } from '../../src/engine/quests';
import { warePrice, buy } from '../../src/engine/trade';
import { actorById } from '../../src/engine/relations';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { FN } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import { SV } from '../../src/library/serviceIds';
import { IT } from '../../src/library/itemIds';
import { actorBody } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { GameEvent, GameState, Quest, RollResult } from '../../src/types';

const earned = (s: GameState) => (s.player.progression?.achievements ?? []).filter((a) => !a.replacedBy).map((a) => a.key);
const ids = (s: GameState) => (s.player.progression?.achievements ?? []).map((a) => a.id);
const attackEv = (s: GameState, o: Record<string, unknown>): GameEvent =>
  ({ id: 'e', turn: s.turn, actorId: 'x', kind: 'attack', zone: s.player.zone, effects: [], noise: 'normal', visibility: 'normal', perception: {}, attack: o } as unknown as GameEvent);
const roll = (actorId: string, skill: string): RollResult => ({ actorId, skill, d100: 50, margin: 0, tier: 'success', natural: 0, modifiers: [], tierShifts: [] });

describe('140 achievement ideas', () => {
  it('N1 clean defenses: a dodge or block that stops the hit completely', () => {
    const s = makeVillage();
    const clean = attackEv(s, { attackerId: 'slime_1', targetId: s.player.id, defense: {}, outcome: 'dodged', damage: 0, attack: {} });
    turnFeats(s, Array.from({ length: 9 }, () => clean));
    expect(earned(s)).not.toContain(ACH.clean_10);
    turnFeats(s, [attackEv(s, { attackerId: 'slime_1', targetId: s.player.id, defense: {}, outcome: 'blocked', damage: 3, attack: {} })]);
    expect(earned(s)).not.toContain(ACH.clean_10); // a block that still let damage through
    turnFeats(s, [clean]);
    expect(earned(s)).toContain(ACH.clean_10);
  });

  it('N8 aimed hits per part size: smaller parts pay a reward level more', () => {
    const s = makeVillage();
    const d = getLibrary().achievements![ACH.aimed_size_10];
    expect(achLevel(d, 'normal')).toBe('i');
    expect(achLevel(d, 'small')).toBe('ii');
    expect(achLevel(d, 'tiny')).toBe('iii');
    const xp = s.player.progression!.xpLog?.length ?? 0;
    for (let i = 0; i < 10; i++) tally(s, 'aimed_hits', { by: 'size', of: 'tiny' });
    expect(ids(s)).toContain(`${ACH.aimed_size_10}:tiny`);
    expect(s.player.progression!.xpLog!.slice(xp).map((x) => x.amount)).toContain(CONFIG.REWARD_XP.iii);
    expect(achievementName(s, { id: `${ACH.aimed_size_10}:extra_small`, key: ACH.aimed_size_10, of: 'extra_small' })).toBe('Extra Small Target');
  });

  it('N5 buying counts the copper spent', () => {
    const s = makeVillage({ playerZone: 'tav_counter' });
    const mags = actorById(s, 'trader')!;
    mags.wares = { items: [], services: [SV.clinic] };
    const price = warePrice(s, s.player, mags, `service:${SV.clinic}`)!;
    s.player.core.inventory.push({ id: 'purse', itemId: IT.coin, qty: 500 });
    expect(buy(s, s.player, mags, `service:${SV.clinic}`, 1).ok).toBe(true);
    expect(s.player.progression!.tally!.coin_spent).toBe(price);
  });

  it('N4c a contest won against higher true skill counts, in general and per function', () => {
    const s = makeVillage();
    const wim = actor(s, 'patron_1');
    s.player.core.skills[SK.sneaking] = { raw: 10, state: 'normal' };
    wim.core.skills[SK.eyesight] = { raw: 60, state: 'normal' };
    contestFeat(s, { a: roll(s.player.id, SK.sneaking), b: roll(wim.id, SK.eyesight), gap: -1, winner: 'a' });
    expect(earned(s)).toContain(ACH.outmatched_1);
    expect(ids(s)).toContain(`${ACH.outmatched_fn_1}:${FN.stealth}`);
    const n = ids(s).length;
    contestFeat(s, { a: roll(s.player.id, SK.sneaking), b: roll(wim.id, SK.eyesight), gap: 0, winner: 'tie' });
    expect(ids(s).length).toBe(n); // a tie wins nothing
  });

  it('N6 back from Down to Unhurt, and a Crippled part healed back to Healthy', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 120;
    turnFeats(s, []);
    s.player.core.condition.hpLostPct = 10;
    turnFeats(s, []);
    expect(earned(s)).not.toContain(ACH.back_from_down_1);
    s.player.core.condition.hpLostPct = 0;
    turnFeats(s, []);
    expect(earned(s)).toContain(ACH.back_from_down_1);
    s.player.progression!.crippled = [actorBody(s, s.player).parts[0].id]; // Crippled earlier, Healthy now
    turnFeats(s, []);
    expect(earned(s)).toContain(ACH.mended_1);
  });

  it('N4d someone once hostile to you who turns friendly', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1');
    slime.mind!.overrides = { [s.player.id]: 'hostile' };
    turnFeats(s, []);
    slime.mind!.overrides = { [s.player.id]: 'friendly' };
    turnFeats(s, []);
    expect(earned(s)).toContain(ACH.enemy_friend_1);
  });

  it('N9 quests: per giver, many givers, a finished run of follow-ups, early, unpaid', () => {
    const s = makeVillage();
    s.clocks = { ...s.clocks };
    const q = (id: string, giver: string, more: Partial<Quest> = {}): Quest => {
      const x: Quest = { id, state: 'ready', text: 'a job', giver, dealId: `d_${id}`, goal: { kind: 'other' }, progress: 0, level: 'i' as Quest['level'], startTurn: 0, pay: { coin: 5 }, giverSaw: true, ...more };
      s.quests.push(x);
      return x;
    };
    q('q1', 'trader');
    handInQuests(s, () => true);
    expect(earned(s)).not.toContain(ACH.quest_chain_1);
    q('q2', 'trader', { after: 'q1' });
    handInQuests(s, () => true);
    expect(earned(s)).toContain(ACH.quest_chain_1);
    for (const n of [3, 4, 5]) q(`q${n}`, 'trader');
    handInQuests(s, () => true);
    expect(ids(s)).toContain(`${ACH.quests_giver_5}:trader`);
    expect(earned(s)).not.toContain(ACH.quests_unpaid_1);
    q('q6', 'trader', { pay: undefined });
    handInQuests(s, () => true);
    expect(earned(s)).toContain(ACH.quests_unpaid_1);
    q('q7', 'trader', { startAt: 0, due: 1_000_000 });
    handInQuests(s, () => true);
    expect(earned(s)).toContain(ACH.quests_early_1);
  });
});
