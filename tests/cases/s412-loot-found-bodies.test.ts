// 412 D-253 b: at a scenario's end every NPC standing that found a body (down or dead) loots it when its personality says
// it takes: hostile to the dead, valuing Wealth, dishonest (Honesty below 0) or poor (under POOR_COIN coin). It takes as
// WP6 a does: all the coin, then the most valuable things, up to LOOT_TAKE_MAX. Others leave the body as it lies.
import { describe, expect, it } from 'vitest';
import type { Actor, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { closeScenario, endScenario, frameOf } from '../../src/engine/scenarioEnd';
import { coins } from '../../src/engine/trade';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { PA, VL } from '../../src/library/tableIds';

const frame = (s: GameState) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r));
const end = (s: GameState) => { endScenario(s, 'resolved', ''); s.stage.breakCause = 'scenario_end' as never; return closeScenario(s); };
/** the guard lies dead with a dagger and 20 coin; the patron found the body; nobody is hostile to the guard */
const setUp = (patron: (p: Actor) => void) => {
  const s = makeVillage();
  const body = actor(s, 'guard_1'), p = actor(s, 'patron_1');
  body.core.condition.hpLostPct = 100;
  body.core.inventory = [{ id: 'g_coin', itemId: IT.coin, qty: 20 }, { id: 'g_dagger', itemId: IT.dagger }];
  p.core.inventory = [{ id: 'p_coin', itemId: IT.coin, qty: CONFIG.POOR_COIN + 40 }];
  p.core.personality = { nerve: 0, traits: { [PA.honesty]: 40 }, values: [] };
  p.mind!.bodiesFound = [body.id];
  patron(p);
  frame(s);
  return { s, body, p };
};

describe('412 NPCs loot the bodies they found when a scenario ends (D-253 b)', () => {
  it('an honest NPC with coin, not hostile and not valuing Wealth, leaves the body as it lies', () => {
    const { s, body, p } = setUp(() => {});
    end(s);
    expect(body.core.inventory.map((i) => i.id)).toEqual(['g_coin', 'g_dagger']);
    expect(coins(p)).toBe(CONFIG.POOR_COIN + 40);
  });
  it.each([
    ['dishonest', (p: Actor) => { p.core.personality!.traits[PA.honesty] = -10; }],
    ['valuing Wealth', (p: Actor) => { p.core.personality!.values = [VL.wealth]; }],
    ['poor', (p: Actor) => { p.core.inventory = []; }],
  ])('a %s NPC who found it takes the coin and the dagger', (_why, make) => {
    const { s, body, p } = setUp(make);
    const before = coins(p);
    end(s);
    expect(body.core.inventory).toEqual([]);
    expect(coins(p)).toBe(before + 20);
    expect(p.core.inventory.some((i) => i.id === 'g_dagger')).toBe(true);
  });
  it('a dishonest NPC who never found the body takes nothing', () => {
    const { s, body } = setUp((p) => { p.core.personality!.traits[PA.honesty] = -10; p.mind!.bodiesFound = []; });
    end(s);
    expect(body.core.inventory).toHaveLength(2);
  });
});
