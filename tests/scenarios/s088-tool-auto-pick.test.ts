import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { pickTool, ruleset } from '../../src/ruleset';

describe('88 Tool auto-pick', () => {
  it('uses the better of two lockpick kits; with both hands full the off-hand item is stowed', () => {
    const s = makeVillage();
    s.hidden.stage.challenge = 'minor'; // target 35
    s.blueprints.push({ storyId: 'test', id: 'fine_lockpicks', kind: 'item', data: {
      id: 'fine_lockpicks', kind: 'tool', name: 'fine lockpicks', look: 'fine picks', bulk: 0, value: 30, hands: 1,
      effects: [{ kind: 'skill', skill: 'lockpicking', value: 35, active: 'inUse', scope: 'withItem' }] } });
    s.player.core.inventory.push({ id: 'lp1', itemId: 'lockpicks' }, { id: 'lp2', itemId: 'fine_lockpicks' });
    // sword and shield held: the shield (off hand) is stowed for free
    expect(pickTool(s, s.player, 'lockpicking')).toEqual({ itemId: 'lp2', stowed: 'player_round_shield_2' });
    const before = JSON.stringify(s);
    const r = ruleset.check({ actorId: 'player', skill: 'lockpicking', modifiers: [] }, s, createRng(1));
    expect(r.passed).toBe(true); // 0 + 35 ≥ 35; the plain kit (25) would fail
    expect(JSON.stringify(s)).toBe(before); // the check itself spends and changes nothing
    // a free hand: nothing stowed
    delete s.player.core.inventory.find((i) => i.id === 'player_round_shield_2')!.equippedIn;
    expect(pickTool(s, s.player, 'lockpicking')).toEqual({ itemId: 'lp2', stowed: null });
  });
});
